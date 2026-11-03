import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Search,
  Pill,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  PlusCircle,
  Clock,
  Calendar,
  Utensils,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';
import { useBulario } from '@/hooks/useBulario';
import {
  RegraBulario,
  EspeciePaciente,
  detectarRiscoMdr1PorRaca,
  ROTULO_CONDICAO_ALIMENTAR,
} from '@/lib/receituarioMotor';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export interface PacienteContextoBulario {
  nome: string;
  especie: EspeciePaciente;
  raca?: string | null;
  peso_kg?: number | null;
  tutor_nome?: string | null;
  tutor_telefone?: string | null;
  veterinario?: string | null;
}

interface BularioProntuarioDialogProps {
  aberto: boolean;
  onOpenChange: (aberto: boolean) => void;
  paciente: PacienteContextoBulario;
  onInserirNoProntuario: (textoPosologia: string) => void;
}

export function BularioProntuarioDialog({
  aberto,
  onOpenChange,
  paciente,
  onInserirNoProntuario,
}: BularioProntuarioDialogProps) {
  const navigate = useNavigate();
  const { medicamentos, calcularDose } = useBulario();

  const [busca, setBusca] = useState('');
  const [classeFiltro, setClasseFiltro] = useState<string>('todas');
  const [itemSelecionado, setItemSelecionado] = useState<RegraBulario | null>(null);

  // Parâmetros ajustáveis pelo veterinário na hora da escolha
  const [frequenciaHoras, setFrequenciaHoras] = useState<number>(12);
  const [duracaoDias, setDuracaoDias] = useState<number>(7);
  const [doseMgKgPersonalizada, setDoseMgKgPersonalizada] = useState<number | null>(null);

  // Peso efetivo (do contexto ou fallback para 10kg se ainda não pesado)
  const pesoEfetivo = paciente.peso_kg && paciente.peso_kg > 0 ? paciente.peso_kg : 10;
  const pesoAferido = Boolean(paciente.peso_kg && paciente.peso_kg > 0);

  // Detecta MDR1
  const temRiscoMdr1 = useMemo(() => {
    return detectarRiscoMdr1PorRaca(paciente.especie, paciente.raca);
  }, [paciente.especie, paciente.raca]);

  // Lista de classes terapêuticas disponíveis para filtro rápido
  const classesDisponiveis = useMemo(() => {
    const set = new Set<string>();
    medicamentos.forEach((m) => {
      if (m.classe_terapeutica) set.add(m.classe_terapeutica);
    });
    return Array.from(set).sort();
  }, [medicamentos]);

  // Fármacos filtrados
  const farmacosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return medicamentos.filter((med) => {
      // Filtro de classe
      if (classeFiltro !== 'todas' && med.classe_terapeutica !== classeFiltro) {
        return false;
      }
      // Busca por nome, princípio ou palavras-chave
      if (!q) return true;
      return (
        med.principio_ativo.toLowerCase().includes(q) ||
        med.nome_comercial_sugerido.toLowerCase().includes(q) ||
        med.classe_terapeutica.toLowerCase().includes(q) ||
        med.palavras_chave.some((k) => k.toLowerCase().includes(q))
      );
    });
  }, [medicamentos, busca, classeFiltro]);

  // Ao selecionar um fármaco, atualiza os estados padrão
  const selecionarFarmaco = (med: RegraBulario) => {
    setItemSelecionado(med);
    setFrequenciaHoras(med.frequencia_horas_padrao);
    setDuracaoDias(med.duracao_dias_padrao);
    setDoseMgKgPersonalizada(med.dose_padrao_mg_kg);
  };

  // Cálculo dinâmico para o item selecionado
  const calculoPosologico = useMemo(() => {
    if (!itemSelecionado) return null;
    return calcularDose(
      {
        ...itemSelecionado,
        dose_padrao_mg_kg: doseMgKgPersonalizada ?? itemSelecionado.dose_padrao_mg_kg,
        frequencia_horas_padrao: frequenciaHoras,
        duracao_dias_padrao: duracaoDias,
      },
      pesoEfetivo,
      paciente.especie,
      paciente.raca || undefined
    );
  }, [itemSelecionado, doseMgKgPersonalizada, frequenciaHoras, duracaoDias, pesoEfetivo, paciente, calcularDose]);

  // Checagem de contraindicação
  const contraindicado = useMemo(() => {
    if (!itemSelecionado) return false;
    return itemSelecionado.especies_contraindicadas.includes(paciente.especie);
  }, [itemSelecionado, paciente.especie]);

  const alertaMdr1 = useMemo(() => {
    if (!itemSelecionado) return false;
    return itemSelecionado.risco_mdr1 && temRiscoMdr1;
  }, [itemSelecionado, temRiscoMdr1]);

  // Formata o texto para ser inserido no campo de medicamentos do prontuário
  const handleInserirProntuario = () => {
    if (!itemSelecionado || !calculoPosologico) return;

    const viaTexto = itemSelecionado.icone_via.toUpperCase();
    const condicao = ROTULO_CONDICAO_ALIMENTAR[itemSelecionado.condicao_alimentar] || 'com alimento';
    const pesoTexto = pesoAferido ? ` (Dose para ${pesoEfetivo} kg)` : ' (Aferir peso para conferência)';

    const linhaFormatada =
      `• ${calculoPosologico.nome_comercial_sugerido} (${calculoPosologico.principio_ativo}): ` +
      `${calculoPosologico.posologia.quantidade_por_tomada} por via ${viaTexto} ` +
      `a cada ${frequenciaHoras}h por ${duracaoDias} dias, ${condicao}. ` +
      `[${calculoPosologico.memoria_calculo}]${pesoTexto}`;

    onInserirNoProntuario(linhaFormatada);
    toast.success(`${itemSelecionado.nome_comercial_sugerido} inserido no prontuário!`);
    onOpenChange(false);
  };

  // Leva direto para a emissão formal no receituário inteligente
  const handleAbrirNoReceituario = () => {
    if (!itemSelecionado) return;
    const params = new URLSearchParams();
    if (paciente.nome) params.set('pet', paciente.nome);
    if (paciente.tutor_nome) params.set('tutor', paciente.tutor_nome);
    if (paciente.tutor_telefone) params.set('telefone', paciente.tutor_telefone);
    if (paciente.especie) params.set('especie', paciente.especie);
    if (paciente.raca) params.set('raca', paciente.raca);
    if (pesoAferido && paciente.peso_kg) params.set('peso', String(paciente.peso_kg));
    if (paciente.veterinario) params.set('vet', paciente.veterinario);

    toast.info('Abrindo Receituário Inteligente com os dados do paciente...');
    onOpenChange(false);
    navigate(`/receituario?${params.toString()}`);
  };

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        {/* Cabeçalho */}
        <DialogHeader className="p-5 pb-3 border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Pill className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  Bulário Clínico Veterinário
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Consulta terapêutica, cálculo posológico automatizado e inserção direta no prontuário.
                </DialogDescription>
              </div>
            </div>

            {/* Contexto do Paciente */}
            <div className="flex items-center gap-2 bg-background border px-3 py-1.5 rounded-md text-xs">
              <span className="font-semibold text-foreground">{paciente.nome || 'Paciente'}</span>
              <span className="text-muted-foreground">·</span>
              <Badge variant="outline" className="text-[10px] capitalize">
                {paciente.especie}
              </Badge>
              {paciente.raca && (
                <span className="text-muted-foreground text-[11px]">({paciente.raca})</span>
              )}
              <span className="text-muted-foreground">·</span>
              <Badge variant={pesoAferido ? 'secondary' : 'destructive'} className="text-[10px]">
                {pesoAferido ? `${paciente.peso_kg} kg` : 'Peso não aferido (est. 10 kg)'}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        {/* Corpo: Duas colunas (Busca & Lista na esquerda, Detalhes & Cálculo na direita) */}
        <div className="grid grid-cols-1 md:grid-cols-12 flex-1 overflow-hidden divide-y md:divide-y-0 md:divide-x">
          {/* Coluna Esquerda: Busca e Seleção (5 colunas) */}
          <div className="md:col-span-5 flex flex-col h-full overflow-hidden bg-card p-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar fármaco, princípio ou sintoma..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            {/* Chips de filtro de classe */}
            <div className="flex gap-1 overflow-x-auto pb-1 text-xs no-scrollbar">
              <Button
                variant={classeFiltro === 'todas' ? 'default' : 'outline'}
                size="sm"
                className="h-6 text-[10px] px-2 rounded-full shrink-0"
                onClick={() => setClasseFiltro('todas')}
              >
                Todas ({medicamentos.length})
              </Button>
              {classesDisponiveis.map((cls) => (
                <Button
                  key={cls}
                  variant={classeFiltro === cls ? 'default' : 'outline'}
                  size="sm"
                  className="h-6 text-[10px] px-2 rounded-full shrink-0 capitalize"
                  onClick={() => setClasseFiltro(cls)}
                >
                  {cls.replace(/_/g, ' ')}
                </Button>
              ))}
            </div>

            {/* Lista de Fármacos */}
            <ScrollArea className="flex-1 pr-2">
              <div className="space-y-1.5">
                {farmacosFiltrados.map((med) => {
                  const isSelected = itemSelecionado?.slug === med.slug;
                  const isContra = med.especies_contraindicadas.includes(paciente.especie);
                  const isMdr = med.risco_mdr1 && temRiscoMdr1;

                  return (
                    <button
                      key={med.slug}
                      type="button"
                      onClick={() => selecionarFarmaco(med)}
                      className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-xs'
                          : 'border-border hover:bg-muted/50 bg-background'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-foreground truncate">
                            {med.nome_comercial_sugerido}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {med.principio_ativo}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-[9px] uppercase tracking-wider shrink-0">
                          {med.icone_via}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {med.dose_padrao_mg_kg} mg/kg
                        </span>
                        {isContra && (
                          <Badge variant="destructive" className="text-[9px] py-0 px-1 gap-1">
                            <ShieldAlert className="h-2.5 w-2.5" /> Tóxico {paciente.especie}
                          </Badge>
                        )}
                        {isMdr && (
                          <Badge className="text-[9px] py-0 px-1 bg-amber-600 text-white gap-1">
                            <AlertTriangle className="h-2.5 w-2.5" /> Risco MDR1
                          </Badge>
                        )}
                      </div>
                    </button>
                  );
                })}

                {farmacosFiltrados.length === 0 && (
                  <div className="text-center py-10 text-muted-foreground text-xs">
                    Nenhum medicamento encontrado para "{busca}".
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Coluna Direita: Detalhes, Cálculo e Ações (7 colunas) */}
          <div className="md:col-span-7 flex flex-col h-full overflow-hidden bg-muted/10 p-5 space-y-4">
            {itemSelecionado && calculoPosologico ? (
              <ScrollArea className="flex-1 pr-3">
                <div className="space-y-4">
                  {/* Título & Alertas */}
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-bold text-foreground">
                        {itemSelecionado.nome_comercial_sugerido}
                      </h3>
                      <Badge variant="secondary" className="text-[10px] capitalize">
                        {itemSelecionado.classe_terapeutica.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground font-medium">
                      Princípio: {itemSelecionado.principio_ativo}
                    </p>
                  </div>

                  {/* Alerta de Contraindicação Severa */}
                  {contraindicado && (
                    <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex gap-2 text-destructive text-xs">
                      <ShieldAlert className="h-5 w-5 shrink-0" />
                      <div>
                        <p className="font-bold">CONTRAINDICAÇÃO SEVERA PARA FELINOS / ESPÉCIE ALVO</p>
                        <p className="text-[11px] mt-0.5">
                          {itemSelecionado.motivo_contraindicacao_especie ||
                            'Este fármaco apresenta alto risco de toxicidade para a espécie deste paciente.'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Alerta MDR1 */}
                  {alertaMdr1 && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex gap-2 text-amber-700 dark:text-amber-400 text-xs">
                      <AlertTriangle className="h-5 w-5 shrink-0" />
                      <div>
                        <p className="font-bold">ALERTA GENÉTICO MDR1</p>
                        <p className="text-[11px] mt-0.5">
                          {itemSelecionado.mensagem_mdr1 ||
                            'A raça deste paciente possui alta incidência de mutação no gene ABCB1/MDR1.'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Card de Cálculo Posológico para o Peso do Pet */}
                  <Card className="border-primary/20 bg-primary/5 shadow-none">
                    <CardContent className="p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                          <Sparkles className="h-4 w-4" /> Posologia Recomendada
                        </span>
                        <span className="text-[11px] text-muted-foreground font-medium">
                          Base: {pesoEfetivo} kg ({paciente.especie})
                        </span>
                      </div>

                      <div className="p-2.5 bg-background rounded-md border space-y-1">
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs text-muted-foreground">Dose calculada:</span>
                          <span className="text-sm font-bold text-foreground">
                            {calculoPosologico.posologia.dose_calculada_mg} mg
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs text-muted-foreground">Apresentação / Tomada:</span>
                          <span className="text-sm font-bold text-primary">
                            {calculoPosologico.posologia.quantidade_por_tomada}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono pt-1 border-t">
                          {calculoPosologico.memoria_calculo}
                        </div>
                      </div>

                      {/* Ajustes rápidos de Frequência e Duração */}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div>
                          <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Intervalo
                          </Label>
                          <div className="flex gap-1 mt-1">
                            {[8, 12, 24].map((h) => (
                              <Button
                                key={h}
                                type="button"
                                variant={frequenciaHoras === h ? 'default' : 'outline'}
                                size="sm"
                                className="h-6 text-[10px] px-2 flex-1"
                                onClick={() => setFrequenciaHoras(h)}
                              >
                                {h}h
                              </Button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> Duração (dias)
                          </Label>
                          <div className="flex gap-1 mt-1">
                            {[3, 5, 7, 10, 14].map((d) => (
                              <Button
                                key={d}
                                type="button"
                                variant={duracaoDias === d ? 'default' : 'outline'}
                                size="sm"
                                className="h-6 text-[10px] px-1.5 flex-1"
                                onClick={() => setDuracaoDias(d)}
                              >
                                {d}d
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Informações de Condição Alimentar e Orientações */}
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2 p-2 bg-muted/40 rounded-md">
                      <Utensils className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium">
                        {ROTULO_CONDICAO_ALIMENTAR[itemSelecionado.condicao_alimentar] || 'Com alimento'}
                      </span>
                    </div>

                    <div className="p-2.5 bg-muted/40 rounded-md space-y-1">
                      <p className="font-semibold text-foreground text-[11px]">Orientações ao Tutor:</p>
                      <p className="text-muted-foreground text-xs leading-relaxed">
                        {itemSelecionado.orientacoes_padrao}
                      </p>
                    </div>

                    {itemSelecionado.apresentacoes && itemSelecionado.apresentacoes.length > 0 && (
                      <div className="space-y-1">
                        <p className="font-semibold text-foreground text-[11px]">Apresentações Disponíveis:</p>
                        <div className="flex flex-wrap gap-1">
                          {itemSelecionado.apresentacoes.map((ap, idx) => (
                            <Badge key={idx} variant="outline" className="text-[10px] py-0.5">
                              {ap.rotulo}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </ScrollArea>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-6 text-muted-foreground">
                <Pill className="h-10 w-10 stroke-1 mb-2 text-muted-foreground/60" />
                <p className="text-sm font-semibold text-foreground">Selecione um medicamento</p>
                <p className="text-xs max-w-xs mt-1">
                  Selecione qualquer fármaco da lista à esquerda para conferir a dose exata, apresentações e alertas de segurança.
                </p>
              </div>
            )}

            {/* Rodapé de Ações */}
            {itemSelecionado && (
              <div className="pt-3 border-t flex flex-col sm:flex-row items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto text-xs gap-1.5"
                  onClick={handleAbrirNoReceituario}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Abrir no Receituário Oficial
                </Button>

                <Button
                  type="button"
                  size="sm"
                  className="w-full sm:w-auto text-xs font-bold gap-1.5"
                  disabled={contraindicado}
                  onClick={handleInserirProntuario}
                >
                  <PlusCircle className="h-4 w-4" />
                  Inserir no Prontuário
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Rodapé geral */}
        <DialogFooter className="px-5 py-2.5 border-t bg-muted/20 flex justify-between items-center sm:justify-between">
          <p className="text-[11px] text-muted-foreground">
            {medicamentos.length} medicamentos catalogados no bulário determinístico.
          </p>
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

