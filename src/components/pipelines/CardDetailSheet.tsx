import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowRightLeft,
  BookOpen,
  CalendarDays,
  CheckSquare,
  Clock,
  Dog,
  ExternalLink,
  FileText,
  History,
  MessageSquare,
  Phone,
  Plus,
  Save,
  Send,
  Sparkles,
  Trash2,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { sendText } from '@/services/uazapi';
import { toWhatsappNumber } from '@/lib/formatters';
import {
  CARD_ORIGEM_LABELS,
  CARD_PRIORIDADE_LABELS,
  CardOrigem,
  CardPrioridade,
  ChecklistItem,
  CrmPipeline,
  CrmPipelineActivity,
  CrmPipelineCard,
  CrmPipelineStage,
} from '@/types/pipeline';
import { Atendente } from '@/types/atendimento';
import {
  avaliarSlaCard,
  criarChecklistDeTextos,
  montarLinkConversa,
  montarLinkProntuario,
} from '@/lib/pipelineDefaults';
import TagBadge from '@/components/tags/TagBadge';
import TagPicker from '@/components/tags/TagPicker';
import PendenciasSection from '@/components/pendencias/PendenciasSection';
import { useTags } from '@/hooks/useTags';

interface CardDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: CrmPipelineCard | null;
  pipelines: CrmPipeline[];
  stagesByPipeline: Map<string, CrmPipelineStage[]>;
  atendentes: Atendente[];
  activities: CrmPipelineActivity[];
  onMoveCard: (input: {
    cardId: string;
    toStageId: string;
    toPipelineId?: string;
    motivoPerda?: string | null;
  }) => Promise<unknown>;
  onUpdateCard: (input: {
    id: string;
    changes: Partial<CrmPipelineCard>;
    sincronizarCliente?: boolean;
  }) => Promise<unknown>;
  onDeleteCard: (cardId: string) => Promise<unknown>;
  onAddActivity: (input: {
    cardId: string;
    tipo?: CrmPipelineActivity['tipo'];
    descricao: string;
  }) => Promise<unknown>;
}

export const CardDetailSheet: React.FC<CardDetailSheetProps> = ({
  open,
  onOpenChange,
  card,
  pipelines,
  stagesByPipeline,
  atendentes,
  activities,
  onMoveCard,
  onUpdateCard,
  onDeleteCard,
  onAddActivity,
}) => {
  const { tagsPorCliente, unassignTag } = useTags();

  const [nomeContato, setNomeContato] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [nomePet, setNomePet] = useState('');
  const [especiePet, setEspeciePet] = useState('');
  const [racaPet, setRacaPet] = useState('');
  const [portePet, setPortePet] = useState('');
  const [servicoInteresse, setServicoInteresse] = useState('');
  const [valorEstimado, setValorEstimado] = useState('');
  const [prioridade, setPrioridade] = useState<CardPrioridade>('media');
  const [origem, setOrigem] = useState<CardOrigem>('whatsapp');
  const [campanha, setCampanha] = useState('');
  const [atendenteId, setAtendenteId] = useState<string>('none');
  const [proximaAcao, setProximaAcao] = useState('');
  const [proximaAcaoEm, setProximaAcaoEm] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [motivoPerda, setMotivoPerda] = useState('');
  const [novoChecklistTexto, setNovoChecklistTexto] = useState('');
  const [novaNota, setNovaNota] = useState('');
  const [quickMsgText, setQuickMsgText] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [transferPipelineId, setTransferPipelineId] = useState<string>('');

  useEffect(() => {
    if (!card) return;
    setNomeContato(card.nomeContato);
    setTelefone(card.telefone || '');
    setEmail(card.email || '');
    setNomePet(card.nomePet || '');
    setEspeciePet(card.especiePet || '');
    setRacaPet(card.racaPet || '');
    setPortePet(card.portePet || '');
    setServicoInteresse(card.servicoInteresse || '');
    setValorEstimado(card.valorEstimado ? String(card.valorEstimado) : '');
    setPrioridade(card.prioridade);
    setOrigem(card.origem);
    setCampanha(card.campanha || '');
    setAtendenteId(card.atendenteId ? String(card.atendenteId) : 'none');
    setProximaAcao(card.proximaAcao || '');
    setProximaAcaoEm(
      card.proximaAcaoEm ? new Date(card.proximaAcaoEm).toISOString().slice(0, 16) : ''
    );
    setObservacoes(card.observacoes || '');
    setMotivoPerda(card.motivoPerda || '');
    setTransferPipelineId(card.pipelineId);
  }, [card]);

  if (!card) return null;

  const currentStages = stagesByPipeline.get(card.pipelineId) || [];
  const currentStage = currentStages.find((s) => s.id === card.stageId) || currentStages[0];
  const sla = avaliarSlaCard(card.movidoEm, currentStage?.slaHoras, currentStage?.tipo);
  const clientTags = card.clientId ? tagsPorCliente.get(card.clientId) || [] : [];
  const chatUrl = montarLinkConversa(card);
  const prontuarioUrl = montarLinkProntuario(card);

  const handleSaveDetails = async () => {
    const valorNum = parseFloat(valorEstimado.replace(',', '.'));
    await onUpdateCard({
      id: card.id,
      sincronizarCliente: true,
      changes: {
        titulo: nomeContato.trim() || card.titulo,
        nomeContato: nomeContato.trim() || card.nomeContato,
        telefone: telefone.trim() || null,
        email: email.trim() || null,
        nomePet: nomePet.trim() || null,
        especiePet: especiePet.trim() || null,
        racaPet: racaPet.trim() || null,
        portePet: portePet.trim() || null,
        servicoInteresse: servicoInteresse.trim() || null,
        valorEstimado: !Number.isNaN(valorNum) && valorNum >= 0 ? valorNum : 0,
        prioridade,
        origem,
        campanha: campanha.trim() || null,
        atendenteId: atendenteId !== 'none' ? parseInt(atendenteId, 10) : null,
        proximaAcao: proximaAcao.trim() || null,
        proximaAcaoEm: proximaAcaoEm ? new Date(proximaAcaoEm).toISOString() : null,
        observacoes: observacoes.trim() || null,
        motivoPerda: motivoPerda.trim() || null,
      },
    });
    toast.success('Dados salvos com sucesso!');
  };

  const handleToggleChecklistItem = async (itemId: string) => {
    const updated: ChecklistItem[] = card.checklist.map((item) =>
      item.id === itemId ? { ...item, concluido: !item.concluido } : item
    );
    await onUpdateCard({
      id: card.id,
      changes: { checklist: updated },
    });
  };

  const handleAddChecklistItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoChecklistTexto.trim()) return;
    const newItem: ChecklistItem = {
      id: `chk-${Date.now()}`,
      texto: novoChecklistTexto.trim(),
      concluido: false,
    };
    setNovoChecklistTexto('');
    await onUpdateCard({
      id: card.id,
      changes: { checklist: [...card.checklist, newItem] },
    });
  };

  const handleRemoveChecklistItem = async (itemId: string) => {
    const updated = card.checklist.filter((item) => item.id !== itemId);
    await onUpdateCard({
      id: card.id,
      changes: { checklist: updated },
    });
  };

  const handleLoadStageChecklist = async () => {
    if (!currentStage?.checklistPadrao?.length) return;
    const items = criarChecklistDeTextos(currentStage.checklistPadrao);
    await onUpdateCard({
      id: card.id,
      changes: { checklist: [...card.checklist, ...items] },
    });
    toast.success('Passos sugeridos da etapa adicionados ao checklist!');
  };

  const handleCreateClientFromLead = async () => {
    try {
      const { data, error } = await supabase
        .from('dados_cliente')
        .insert({
          nome: nomeContato.trim() || card.nomeContato,
          telefone: telefone.trim() || card.telefone,
          email: email.trim() || card.email,
          nome_pet: nomePet.trim() || card.nomePet,
          raca_pet: racaPet.trim() || card.racaPet,
          porte_pet: portePet.trim() || card.portePet,
          servico: servicoInteresse.trim() || card.servicoInteresse,
          sessionid: card.sessionId || telefone.replace(/\D/g, '') || null,
        })
        .select('id')
        .single();

      if (error) throw error;
      if (data?.id) {
        await onUpdateCard({
          id: card.id,
          changes: { clientId: data.id },
        });
        toast.success(`Cliente #${data.id} criado e vinculado com sucesso!`);
      }
    } catch {
      toast.error('Não foi possível criar o cliente na base');
    }
  };

  const handleAddNota = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaNota.trim()) return;
    await onAddActivity({
      cardId: card.id,
      tipo: 'nota',
      descricao: novaNota.trim(),
    });
    setNovaNota('');
  };

  const handleSendQuickWhatsapp = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetPhone = toWhatsappNumber(telefone || card.telefone);
    if (!targetPhone || !quickMsgText.trim()) {
      toast.error('Informe um telefone válido e a mensagem');
      return;
    }

    try {
      setSendingMsg(true);
      await sendText(targetPhone, quickMsgText.trim());
      await onAddActivity({
        cardId: card.id,
        tipo: 'mensagem',
        descricao: `Mensagem WhatsApp enviada: "${quickMsgText.trim()}"`,
      });
      setQuickMsgText('');
      toast.success('Mensagem enviada via WhatsApp!');
    } catch {
      toast.error('Erro ao enviar mensagem via Uazapi');
    } finally {
      setSendingMsg(false);
    }
  };

  const handleTransferPipeline = async (newPipelineId: string) => {
    setTransferPipelineId(newPipelineId);
    if (newPipelineId === card.pipelineId) return;
    const targetStages = stagesByPipeline.get(newPipelineId) || [];
    if (targetStages.length === 0) return;
    await onMoveCard({
      cardId: card.id,
      toPipelineId: newPipelineId,
      toStageId: targetStages[0].id,
    });
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="overflow-y-auto sm:max-w-xl">
          <SheetHeader className="space-y-2 border-b pb-4">
            <div className="flex items-start justify-between gap-2 pr-6">
              <div>
                <SheetTitle className="text-xl flex items-center gap-2">
                  {card.nomeContato}
                  {card.nomePet && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                      🐾 {card.nomePet}
                    </span>
                  )}
                </SheetTitle>
                <SheetDescription className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {sla.rotuloTempo} na etapa
                  </span>
                  {card.clientId ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                      <UserCheck className="h-3.5 w-3.5" />
                      Cliente cadastrado (#{card.clientId})
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleCreateClientFromLead}
                      className="inline-flex items-center gap-1 text-primary underline hover:opacity-80"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      Salvar na base de Clientes
                    </button>
                  )}
                </SheetDescription>
              </div>
            </div>

            {/* Seletor de Estágio Atual e Transferência de Pipeline */}
            <div className="grid grid-cols-1 gap-2 pt-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Etapa Atual no Kanban
                </Label>
                <Select
                  value={card.stageId}
                  onValueChange={(newStageId) =>
                    onMoveCard({ cardId: card.id, toStageId: newStageId })
                  }
                >
                  <SelectTrigger className="h-8 text-xs font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currentStages.map((st) => (
                      <SelectItem key={st.id} value={st.id} className="text-xs">
                        <span className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: st.cor }}
                          />
                          {st.nome}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <ArrowRightLeft className="h-3 w-3" />
                  Pipeline
                </Label>
                <Select value={transferPipelineId} onValueChange={handleTransferPipeline}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {pipelines.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Atalhos Diretos para Conversa, Prontuário e Agenda */}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button size="sm" className="h-8 text-xs gap-1.5" asChild>
                <Link to={chatUrl}>
                  <MessageSquare className="h-3.5 w-3.5" />
                  Abrir Conversa
                  <ExternalLink className="h-3 w-3 opacity-70" />
                </Link>
              </Button>

              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" asChild>
                <Link to={prontuarioUrl}>
                  <FileText className="h-3.5 w-3.5 text-primary" />
                  Prontuário IA
                </Link>
              </Button>

              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" asChild>
                <Link to="/schedule">
                  <CalendarDays className="h-3.5 w-3.5 text-primary" />
                  Abrir Agenda
                </Link>
              </Button>
            </div>
          </SheetHeader>

          {/* Guia Operacional da Etapa */}
          {currentStage?.descricao && (
            <div className="mt-4 rounded-lg border border-primary/25 bg-primary/5 p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                <BookOpen className="h-4 w-4 shrink-0" />
                Guia do Atendimento — {currentStage.nome}
              </div>
              <p className="mt-1 text-xs text-foreground/90 leading-relaxed">
                {currentStage.descricao}
              </p>
            </div>
          )}

          <Tabs defaultValue="atendimento" className="mt-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="atendimento" className="text-xs">
                Roteiro & Dados
              </TabsTrigger>
              <TabsTrigger value="cliente" className="text-xs">
                Tags & Pendências
              </TabsTrigger>
              <TabsTrigger value="historico" className="text-xs">
                Histórico ({activities.length})
              </TabsTrigger>
            </TabsList>

            {/* ABA 1: ROTEIRO, CHECKLIST E DADOS */}
            <TabsContent value="atendimento" className="mt-4 space-y-5">
              {/* Checklist Interativo */}
              <div className="rounded-lg border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold flex items-center gap-1.5">
                    <CheckSquare className="h-4 w-4 text-primary" />
                    Checklist do Atendimento ({card.checklist.filter((c) => c.concluido).length}/
                    {card.checklist.length})
                  </h4>
                  {currentStage?.checklistPadrao && currentStage.checklistPadrao.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[11px] gap-1 text-primary"
                      onClick={handleLoadStageChecklist}
                    >
                      <Sparkles className="h-3 w-3" />
                      Carregar passos da etapa
                    </Button>
                  )}
                </div>

                {card.checklist.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Nenhum passo cadastrado neste card. Adicione passos abaixo ou carregue o roteiro
                    sugerido da etapa.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {card.checklist.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-muted/50"
                      >
                        <label className="flex items-center gap-2 text-xs cursor-pointer flex-1">
                          <Checkbox
                            checked={item.concluido}
                            onCheckedChange={() => handleToggleChecklistItem(item.id)}
                          />
                          <span
                            className={
                              item.concluido ? 'line-through text-muted-foreground' : 'text-foreground'
                            }
                          >
                            {item.texto}
                          </span>
                        </label>
                        <button
                          type="button"
                          onClick={() => handleRemoveChecklistItem(item.id)}
                          className="text-muted-foreground hover:text-destructive text-xs px-1"
                          aria-label="Remover item"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <form onSubmit={handleAddChecklistItem} className="flex gap-2">
                  <Input
                    value={novoChecklistTexto}
                    onChange={(e) => setNovoChecklistTexto(e.target.value)}
                    placeholder="Adicionar passo ao checklist..."
                    className="h-8 text-xs"
                  />
                  <Button type="submit" variant="outline" size="sm" className="h-8 px-2.5">
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </form>
              </div>

              {/* Disparo rápido de mensagem WhatsApp */}
              <form
                onSubmit={handleSendQuickWhatsapp}
                className="rounded-lg border bg-muted/30 p-3 space-y-2"
              >
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Send className="h-3.5 w-3.5 text-emerald-600" />
                  Enviar Mensagem Rápida no WhatsApp
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={quickMsgText}
                    onChange={(e) => setQuickMsgText(e.target.value)}
                    placeholder={`Escreva uma mensagem para ${card.nomeContato}...`}
                    className="h-8 text-xs bg-background"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    className="h-8 gap-1 text-xs"
                    disabled={sendingMsg || !quickMsgText.trim()}
                  >
                    <Send className="h-3.5 w-3.5" />
                    Enviar
                  </Button>
                </div>
              </form>

              {/* Formulário de Edição do Card & Cliente */}
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Nome do Tutor / Contato</Label>
                    <Input
                      value={nomeContato}
                      onChange={(e) => setNomeContato(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs flex items-center gap-1">
                      <Phone className="h-3 w-3" /> Telefone / WhatsApp
                    </Label>
                    <Input
                      value={telefone}
                      onChange={(e) => setTelefone(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Email</Label>
                    <Input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Atendente Responsável</Label>
                    <Select value={atendenteId} onValueChange={setAtendenteId}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem atendente</SelectItem>
                        {atendentes.map((a) => (
                          <SelectItem key={a.id} value={String(a.id)} className="text-xs">
                            {a.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="rounded-lg border p-3 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <Dog className="h-3.5 w-3.5 text-primary" />
                    Dados do Pet
                  </div>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                    <div className="space-y-1">
                      <Label className="text-[11px]">Nome do Pet</Label>
                      <Input
                        value={nomePet}
                        onChange={(e) => setNomePet(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Raça</Label>
                      <Input
                        value={racaPet}
                        onChange={(e) => setRacaPet(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Porte</Label>
                      <Input
                        value={portePet}
                        onChange={(e) => setPortePet(e.target.value)}
                        placeholder="Pequeno, Médio, Grande"
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Serviço / Especialidade</Label>
                    <Input
                      value={servicoInteresse}
                      onChange={(e) => setServicoInteresse(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Valor Estimado (R$)</Label>
                    <Input
                      value={valorEstimado}
                      onChange={(e) => setValorEstimado(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Prioridade</Label>
                    <Select
                      value={prioridade}
                      onValueChange={(v) => setPrioridade(v as CardPrioridade)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(CARD_PRIORIDADE_LABELS) as CardPrioridade[]).map((p) => (
                          <SelectItem key={p} value={p} className="text-xs">
                            {CARD_PRIORIDADE_LABELS[p]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Origem</Label>
                    <Select value={origem} onValueChange={(v) => setOrigem(v as CardOrigem)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(CARD_ORIGEM_LABELS) as CardOrigem[]).map((o) => (
                          <SelectItem key={o} value={o} className="text-xs">
                            {CARD_ORIGEM_LABELS[o]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Campanha</Label>
                    <Input
                      value={campanha}
                      onChange={(e) => setCampanha(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Próxima Ação</Label>
                    <Input
                      value={proximaAcao}
                      onChange={(e) => setProximaAcao(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Data do Follow-up</Label>
                    <Input
                      type="datetime-local"
                      value={proximaAcaoEm}
                      onChange={(e) => setProximaAcaoEm(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Observações do Atendimento</Label>
                  <Textarea
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    rows={3}
                    className="text-xs"
                  />
                </div>

                {currentStage?.tipo === 'perdido' && (
                  <div className="space-y-1">
                    <Label className="text-xs text-destructive">
                      Motivo de Perda / Não Agendamento
                    </Label>
                    <Input
                      value={motivoPerda}
                      onChange={(e) => setMotivoPerda(e.target.value)}
                      placeholder="Ex.: Achou o valor alto, sem horário compatível..."
                      className="h-8 text-xs"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs"
                    onClick={() => setConfirmDeleteOpen(true)}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Remover do Pipeline
                  </Button>

                  <Button type="button" size="sm" onClick={handleSaveDetails} className="gap-1.5">
                    <Save className="h-3.5 w-3.5" />
                    Salvar Alterações
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* ABA 2: TAGS E PENDÊNCIAS DO CLIENTE */}
            <TabsContent value="cliente" className="mt-4 space-y-5">
              {card.clientId ? (
                <>
                  <div className="rounded-lg border p-3.5 space-y-2.5">
                    <h4 className="text-xs font-semibold text-muted-foreground">
                      Tags do Cliente (#{card.clientId})
                    </h4>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {clientTags.map((tag) => (
                        <TagBadge
                          key={tag.id}
                          tag={tag}
                          onRemove={() =>
                            unassignTag.mutate({ clientId: card.clientId!, tagId: tag.id })
                          }
                        />
                      ))}
                      <TagPicker clientId={card.clientId} />
                    </div>
                  </div>

                  <div className="rounded-lg border p-3.5">
                    <PendenciasSection clientId={card.clientId} />
                  </div>
                </>
              ) : (
                <div className="rounded-lg border border-dashed p-6 text-center space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Este lead ainda não está vinculado a um registro na tabela de Clientes da
                    clínica. Crie o vínculo com 1 clique para gerenciar Tags e Pendências oficiais!
                  </p>
                  <Button type="button" size="sm" onClick={handleCreateClientFromLead}>
                    <UserPlus className="mr-1.5 h-4 w-4" />
                    Criar e Vincular Cliente na Base
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* ABA 3: HISTÓRICO DE MOVIMENTAÇÕES E NOTAS */}
            <TabsContent value="historico" className="mt-4 space-y-4">
              <form onSubmit={handleAddNota} className="space-y-2">
                <Label className="text-xs font-semibold">Registrar Nota de Atendimento</Label>
                <div className="flex gap-2">
                  <Input
                    value={novaNota}
                    onChange={(e) => setNovaNota(e.target.value)}
                    placeholder="Ex.: Liguei para o tutor, pediu retorno às 16h..."
                    className="h-8 text-xs"
                  />
                  <Button type="submit" size="sm" className="h-8 text-xs">
                    Registrar
                  </Button>
                </div>
              </form>

              <div className="space-y-2.5">
                {activities.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">
                    Nenhuma atividade registrada ainda para este contato.
                  </p>
                ) : (
                  activities.map((act) => (
                    <div
                      key={act.id}
                      className="rounded-lg border bg-muted/20 p-2.5 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="font-medium text-foreground flex items-center gap-1">
                          <History className="h-3 w-3 text-primary" />
                          {act.autorNome || 'Equipe'}
                        </span>
                        <span>
                          {new Date(act.createdAt).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-foreground/90">{act.descricao}</p>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover {card.nomeContato} deste pipeline?</AlertDialogTitle>
            <AlertDialogDescription>
              O card será removido apenas deste quadro Kanban. O cadastro do cliente e o histórico de
              conversas no WhatsApp continuam intactos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await onDeleteCard(card.id);
                setConfirmDeleteOpen(false);
                onOpenChange(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover do Pipeline
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
