import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Clock,
  Layers,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  CrmPipeline,
  CrmPipelineStage,
  PIPELINE_CATEGORIA_LABELS,
  PIPELINE_COLORS,
  PipelineCategoria,
  STAGE_TIPO_LABELS,
  StageTipo,
} from '@/types/pipeline';
import { PIPELINE_TEMPLATES } from '@/lib/pipelineDefaults';
import { CreatePipelineInput, UpdatePipelineInput } from '@/hooks/usePipelines';

interface EditableStage {
  id?: string;
  nome: string;
  descricao: string;
  cor: string;
  tipo: StageTipo;
  slaHorasText: string;
  checklistText: string;
}

interface PipelineManageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  pipeline?: CrmPipeline | null;
  stages?: CrmPipelineStage[];
  canDelete?: boolean;
  onCreate: (input: CreatePipelineInput) => Promise<unknown>;
  onUpdate: (input: UpdatePipelineInput) => Promise<unknown>;
  onDelete?: (pipelineId: string) => Promise<unknown>;
  isSaving?: boolean;
}

const DEFAULT_NEW_STAGES: EditableStage[] = PIPELINE_TEMPLATES[0].estagios.map((s) => ({
  nome: s.nome,
  descricao: s.descricao,
  cor: s.cor,
  tipo: s.tipo,
  slaHorasText: s.slaHoras ? String(s.slaHoras) : '',
  checklistText: s.checklistPadrao.join('\n'),
}));

export const PipelineManageDialog: React.FC<PipelineManageDialogProps> = ({
  open,
  onOpenChange,
  mode,
  pipeline,
  stages = [],
  canDelete = false,
  onCreate,
  onUpdate,
  onDelete,
  isSaving = false,
}) => {
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState<PipelineCategoria>('atendimento');
  const [cor, setCor] = useState('#0d9488');
  const [padrao, setPadrao] = useState(false);
  const [editableStages, setEditableStages] = useState<EditableStage[]>(DEFAULT_NEW_STAGES);
  const [expandedStageIdx, setExpandedStageIdx] = useState<number | null>(0);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && pipeline) {
      setNome(pipeline.nome);
      setDescricao(pipeline.descricao || '');
      setCategoria(pipeline.categoria);
      setCor(pipeline.cor || '#0d9488');
      setPadrao(pipeline.padrao);
      setEditableStages(
        stages.map((st) => ({
          id: st.id,
          nome: st.nome,
          descricao: st.descricao || '',
          cor: st.cor || '#0d9488',
          tipo: st.tipo,
          slaHorasText: st.slaHoras ? String(st.slaHoras) : '',
          checklistText: (st.checklistPadrao || []).join('\n'),
        }))
      );
      setExpandedStageIdx(0);
    } else {
      const tpl = PIPELINE_TEMPLATES[0];
      setNome('');
      setDescricao('');
      setCategoria('atendimento');
      setCor(tpl.cor);
      setPadrao(false);
      setEditableStages(
        tpl.estagios.map((s) => ({
          nome: s.nome,
          descricao: s.descricao,
          cor: s.cor,
          tipo: s.tipo,
          slaHorasText: s.slaHoras ? String(s.slaHoras) : '',
          checklistText: s.checklistPadrao.join('\n'),
        }))
      );
      setExpandedStageIdx(0);
    }
  }, [open, mode, pipeline, stages]);

  const handleApplyTemplate = (chave: string) => {
    const tpl = PIPELINE_TEMPLATES.find((t) => t.chave === chave);
    if (!tpl) return;
    if (!nome.trim()) setNome(tpl.nome);
    setDescricao(tpl.descricao);
    setCategoria(tpl.categoria);
    setCor(tpl.cor);
    setEditableStages(
      tpl.estagios.map((s) => ({
        nome: s.nome,
        descricao: s.descricao,
        cor: s.cor,
        tipo: s.tipo,
        slaHorasText: s.slaHoras ? String(s.slaHoras) : '',
        checklistText: s.checklistPadrao.join('\n'),
      }))
    );
    setExpandedStageIdx(0);
  };

  const handleAddStage = () => {
    const nextIdx = editableStages.length;
    const nextColor = PIPELINE_COLORS[nextIdx % PIPELINE_COLORS.length];
    setEditableStages((prev) => [
      ...prev,
      {
        nome: `Nova Etapa ${nextIdx + 1}`,
        descricao: '',
        cor: nextColor,
        tipo: 'andamento',
        slaHorasText: '',
        checklistText: '',
      },
    ]);
    setExpandedStageIdx(nextIdx);
  };

  const handleRemoveStage = (idx: number) => {
    if (editableStages.length <= 1) return;
    setEditableStages((prev) => prev.filter((_, i) => i !== idx));
    if (expandedStageIdx === idx) {
      setExpandedStageIdx(null);
    }
  };

  const handleMoveStage = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= editableStages.length) return;
    setEditableStages((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(idx, 1);
      copy.splice(target, 0, moved);
      return copy;
    });
    setExpandedStageIdx(target);
  };

  const updateStageField = <K extends keyof EditableStage>(
    idx: number,
    key: K,
    value: EditableStage[K]
  ) => {
    setEditableStages((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [key]: value } : item))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || editableStages.length === 0) return;

    const normalizedStages = editableStages
      .filter((s) => s.nome.trim().length > 0)
      .map((s, idx) => {
        const slaNum = parseInt(s.slaHorasText.trim(), 10);
        return {
          id: s.id,
          nome: s.nome.trim(),
          descricao: s.descricao.trim() || '',
          cor: s.cor,
          tipo: s.tipo,
          slaHoras: !Number.isNaN(slaNum) && slaNum > 0 ? slaNum : null,
          checklistPadrao: s.checklistText
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean),
          ordem: idx,
        };
      });

    if (normalizedStages.length === 0) return;

    if (mode === 'create') {
      await onCreate({
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        categoria,
        cor,
        padrao,
        estagios: normalizedStages,
      });
    } else if (pipeline) {
      await onUpdate({
        id: pipeline.id,
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        categoria,
        cor,
        padrao,
        estagios: normalizedStages,
      });
    }
    onOpenChange(false);
  };

  const handleConfirmDelete = async () => {
    if (!pipeline || !onDelete) return;
    await onDelete(pipeline.id);
    setConfirmDeleteOpen(false);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Layers className="h-5 w-5 text-primary" />
              {mode === 'create'
                ? 'Criar Novo Pipeline'
                : `Configurar Pipeline: ${pipeline?.nome || ''}`}
            </DialogTitle>
            <DialogDescription>
              Personalize o nome, a categoria e os estágios (colunas do Kanban), incluindo o
              roteiro que orienta o atendente em cada etapa e o alerta de tempo (SLA).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6 py-2">
            {mode === 'create' && (
              <div className="rounded-lg border bg-muted/40 p-3.5 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Começar a partir de um modelo pronto para clínicas veterinárias:
                </div>
                <div className="flex flex-wrap gap-2">
                  {PIPELINE_TEMPLATES.map((tpl) => (
                    <Button
                      key={tpl.chave}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1.5"
                      onClick={() => handleApplyTemplate(tpl.chave)}
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: tpl.cor }}
                      />
                      {tpl.nome}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="pipeline-nome">Nome do Pipeline *</Label>
                <Input
                  id="pipeline-nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex.: Atendimento WhatsApp, Funil de Vacinas..."
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pipeline-categoria">Categoria / Finalidade</Label>
                <Select
                  value={categoria}
                  onValueChange={(v) => setCategoria(v as PipelineCategoria)}
                >
                  <SelectTrigger id="pipeline-categoria">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PIPELINE_CATEGORIA_LABELS) as PipelineCategoria[]).map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {PIPELINE_CATEGORIA_LABELS[cat]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pipeline-desc">Descrição / Objetivo do Pipeline</Label>
              <Input
                id="pipeline-desc"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex.: Organiza os contatos do primeiro oi até o agendamento confirmado"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Cor Principal do Pipeline</Label>
                <div className="flex flex-wrap gap-1.5">
                  {PIPELINE_COLORS.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setCor(hex)}
                      className={`h-6 w-6 rounded-full border-2 transition-transform ${
                        cor === hex ? 'scale-110 border-foreground shadow-sm' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: hex }}
                      aria-label={`Cor ${hex}`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <Switch
                  id="pipeline-padrao"
                  checked={padrao}
                  onCheckedChange={setPadrao}
                />
                <Label htmlFor="pipeline-padrao" className="text-xs font-medium cursor-pointer">
                  Abrir este pipeline por padrão
                </Label>
              </div>
            </div>

            {/* Configuração de Estágios */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold">
                    Estágios do Pipeline ({editableStages.length})
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Configure a ordem das colunas, o roteiro que guia o atendente e o tempo máximo esperado (SLA).
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddStage}
                  className="gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar Estágio
                </Button>
              </div>

              <div className="space-y-2.5">
                {editableStages.map((stage, idx) => {
                  const isExpanded = expandedStageIdx === idx;
                  return (
                    <div
                      key={stage.id || `new-${idx}`}
                      className="rounded-lg border bg-card transition-colors"
                    >
                      <div className="flex items-center gap-2 p-2.5">
                        <span
                          className="h-3.5 w-3.5 shrink-0 rounded-full"
                          style={{ backgroundColor: stage.cor }}
                        />
                        <span className="text-xs font-semibold text-muted-foreground w-5">
                          #{idx + 1}
                        </span>
                        <Input
                          value={stage.nome}
                          onChange={(e) => updateStageField(idx, 'nome', e.target.value)}
                          placeholder="Nome do estágio"
                          className="h-8 text-xs font-medium flex-1"
                          required
                        />
                        <Select
                          value={stage.tipo}
                          onValueChange={(v) => updateStageField(idx, 'tipo', v as StageTipo)}
                        >
                          <SelectTrigger className="h-8 w-[155px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(STAGE_TIPO_LABELS) as StageTipo[]).map((t) => (
                              <SelectItem key={t} value={t} className="text-xs">
                                {STAGE_TIPO_LABELS[t]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-xs"
                          onClick={() => setExpandedStageIdx(isExpanded ? null : idx)}
                        >
                          {isExpanded ? 'Ocultar guia' : 'Guia & SLA'}
                        </Button>

                        <div className="flex items-center gap-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={idx === 0}
                            onClick={() => handleMoveStage(idx, -1)}
                            title="Mover para a esquerda"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={idx === editableStages.length - 1}
                            onClick={() => handleMoveStage(idx, 1)}
                            title="Mover para a direita"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            disabled={editableStages.length <= 1}
                            onClick={() => handleRemoveStage(idx)}
                            title="Remover estágio"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t bg-muted/30 p-3 space-y-3">
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="space-y-1">
                              <Label className="text-xs flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                Meta de SLA na etapa (em horas)
                              </Label>
                              <Input
                                type="number"
                                min={1}
                                value={stage.slaHorasText}
                                onChange={(e) =>
                                  updateStageField(idx, 'slaHorasText', e.target.value)
                                }
                                placeholder="Ex.: 4 (destaca se passar de 4h parado)"
                                className="h-8 text-xs"
                              />
                            </div>

                            <div className="space-y-1">
                              <Label className="text-xs">Cor da Coluna</Label>
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {PIPELINE_COLORS.map((hex) => (
                                  <button
                                    key={hex}
                                    type="button"
                                    onClick={() => updateStageField(idx, 'cor', hex)}
                                    className={`h-5 w-5 rounded-full border transition-transform ${
                                      stage.cor === hex
                                        ? 'scale-110 border-foreground'
                                        : 'border-transparent'
                                    }`}
                                    style={{ backgroundColor: hex }}
                                    aria-label={`Cor do estágio ${hex}`}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs flex items-center gap-1.5">
                              <BookOpen className="h-3.5 w-3.5 text-primary" />
                              Guia de Atendimento para a Equipe nesta Etapa
                            </Label>
                            <Textarea
                              value={stage.descricao}
                              onChange={(e) => updateStageField(idx, 'descricao', e.target.value)}
                              placeholder="O que o atendente deve fazer ou perguntar ao cliente quando ele estiver nesta coluna?"
                              rows={2}
                              className="text-xs"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs">
                              Checklist Padrão da Etapa (1 item por linha)
                            </Label>
                            <Textarea
                              value={stage.checklistText}
                              onChange={(e) =>
                                updateStageField(idx, 'checklistText', e.target.value)
                              }
                              placeholder={
                                'Identificar tutor e pet\nInformar valores de consulta\nSugerir 2 horários disponíveis'
                              }
                              rows={3}
                              className="text-xs font-mono"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <DialogFooter className="flex flex-col sm:flex-row sm:justify-between gap-2 pt-2">
              <div>
                {mode === 'edit' && canDelete && onDelete && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => setConfirmDeleteOpen(true)}
                    disabled={isSaving}
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" />
                    Excluir Pipeline
                  </Button>
                )}
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSaving}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSaving || !nome.trim()}>
                  {isSaving
                    ? 'Salvando...'
                    : mode === 'create'
                    ? 'Criar Pipeline'
                    : 'Salvar Alterações'}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pipeline "{pipeline?.nome}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá o pipeline, seus estágios e os cards vinculados a ele. O
              cadastro dos clientes na base geral não será afetado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirmar Exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
