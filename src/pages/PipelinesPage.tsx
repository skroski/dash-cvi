import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CheckCircle2,
  FilterX,
  Kanban,
  LayoutList,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings2,
  Sparkles,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import PageContainer from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import PauseDurationDialog from '@/components/PauseDurationDialog';
import { supabase } from '@/integrations/supabase/client';
import { sendText } from '@/services/uazapi';
import { toWhatsappNumber } from '@/lib/formatters';
import { usePipelines } from '@/hooks/usePipelines';
import { useAtendentes } from '@/hooks/useAtendentes';
import { useTags } from '@/hooks/useTags';
import { usePendencias } from '@/hooks/usePendencias';
import {
  CARD_ORIGEM_LABELS,
  CARD_PRIORIDADE_LABELS,
  CardOrigem,
  CardPrioridade,
  CrmPipelineCard,
  PIPELINE_CATEGORIA_LABELS,
} from '@/types/pipeline';
import {
  calcularMetricasPipeline,
  filtrarCardsPipeline,
  FiltrosPipeline,
} from '@/lib/pipelineDefaults';
import { PipelineKanbanBoard } from '@/components/pipelines/PipelineKanbanBoard';
import { PipelineManageDialog } from '@/components/pipelines/PipelineManageDialog';
import { AddCardDialog } from '@/components/pipelines/AddCardDialog';
import { CardDetailSheet } from '@/components/pipelines/CardDetailSheet';

const PipelinesPage: React.FC = () => {
  const location = useLocation();
  const [busca, setBusca] = useState('');
  const {
    pipelines,
    cards,
    activePipeline,
    activeStages,
    activeCards,
    selectedPipelineId,
    setSelectedPipelineId,
    stagesByPipeline,
    activitiesByCardId,
    loading,
    modoLocal,
    refresh,
    createPipeline,
    updatePipeline,
    deletePipeline,
    createCard,
    importCardsBatch,
    moveCard,
    updateCard,
    deleteCard,
    addActivity,
    loadMoreContactsFeed,
    hasMoreContactsFeed,
    loadingMoreContactsFeed,
  } = usePipelines(busca);

  const { atendentes, atendenteById } = useAtendentes();
  const { tags, tagsPorCliente } = useTags();
  const { abertasPorCliente } = usePendencias();

  // View & UI controls
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [showStageGuides, setShowStageGuides] = useState(true);
  const [manageDialogMode, setManageDialogMode] = useState<'create' | 'edit'>('edit');
  const [isManageDialogOpen, setIsManageDialogOpen] = useState(false);
  const [isAddCardOpen, setIsAddCardOpen] = useState(false);
  const [addCardDefaultStageId, setAddCardDefaultStageId] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  // Acordeon retrátil de Métricas & Detalhes do Pipeline (lembra a preferência)
  const [isMetricsExpanded, setIsMetricsExpanded] = useState<boolean>(() => {
    try {
      return localStorage.getItem('crm_pipeline_metrics_expanded') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleMetrics = (val: string) => {
    const nextState = val === 'metricas';
    setIsMetricsExpanded(nextState);
    try {
      localStorage.setItem('crm_pipeline_metrics_expanded', String(nextState));
    } catch {}
  };

  // Quick WhatsApp dialog state
  const [quickMessageCard, setQuickMessageCard] = useState<CrmPipelineCard | null>(null);
  const [quickMessageText, setQuickMessageText] = useState('');
  const [isPauseDialogOpen, setIsPauseDialogOpen] = useState(false);

  // Filters
  const [prioridadeFiltro, setPrioridadeFiltro] = useState<CardPrioridade | 'todas'>('todas');
  const [origemFiltro, setOrigemFiltro] = useState<CardOrigem | 'todas'>('todas');
  const [atendenteFiltro, setAtendenteFiltro] = useState<string>('todos');
  const [tagFiltro, setTagFiltro] = useState<string>('todas');
  const [apenasAtrasados, setApenasAtrasados] = useState(false);

  // Reage a query params (?clientId=... ou ?search=...)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const searchParam = params.get('search');
    const clientIdParam = params.get('clientId');
    if (searchParam) {
      setBusca(searchParam);
    }
    if (clientIdParam) {
      const idNum = parseInt(clientIdParam, 10);
      if (!Number.isNaN(idNum)) {
        const found = cards.find((c) => c.clientId === idNum);
        if (found) {
          if (found.pipelineId !== selectedPipelineId) {
            setSelectedPipelineId(found.pipelineId);
          }
          setSelectedCardId(found.id);
        }
      }
    }
  }, [location.search, cards, selectedPipelineId, setSelectedPipelineId]);

  const filtrosAtuais: FiltrosPipeline = useMemo(
    () => ({
      busca,
      prioridade: prioridadeFiltro,
      origem: origemFiltro,
      atendenteId:
        atendenteFiltro === 'todos'
          ? 'todos'
          : atendenteFiltro === 'sem_atendente'
          ? 'sem_atendente'
          : parseInt(atendenteFiltro, 10),
      tagId: tagFiltro === 'todas' ? 'todas' : parseInt(tagFiltro, 10),
      apenasAtrasados,
    }),
    [busca, prioridadeFiltro, origemFiltro, atendenteFiltro, tagFiltro, apenasAtrasados]
  );

  const temFiltrosAtivos =
    busca.trim() !== '' ||
    prioridadeFiltro !== 'todas' ||
    origemFiltro !== 'todas' ||
    atendenteFiltro !== 'todos' ||
    tagFiltro !== 'todas' ||
    apenasAtrasados;

  const limparFiltros = () => {
    setBusca('');
    setPrioridadeFiltro('todas');
    setOrigemFiltro('todas');
    setAtendenteFiltro('todos');
    setTagFiltro('todas');
    setApenasAtrasados(false);
  };

  const cardsFiltrados = useMemo(
    () => filtrarCardsPipeline(activeCards, activeStages, filtrosAtuais, tagsPorCliente),
    [activeCards, activeStages, filtrosAtuais, tagsPorCliente]
  );

  const metricas = useMemo(
    () => calcularMetricasPipeline(activeCards, activeStages),
    [activeCards, activeStages]
  );

  const existingClientIdsInPipeline = useMemo(() => {
    const set = new Set<number>();
    for (const c of activeCards) {
      if (c.clientId) set.add(c.clientId);
    }
    return set;
  }, [activeCards]);

  const selectedCard = useMemo(
    () => cards.find((c) => c.id === selectedCardId) || null,
    [cards, selectedCardId]
  );

  // Cards vindos das conversas só são gravados no pipeline quando o atendente age sobre eles
  const handleCardClick = async (card: CrmPipelineCard) => {
    if (!card.virtualFromConversation) {
      setSelectedCardId(card.id);
      return;
    }
    try {
      const created = await createCard.mutateAsync({
        pipelineId: card.pipelineId,
        stageId: card.stageId,
        clientId: card.clientId,
        sessionId: card.sessionId,
        nomeContato: card.nomeContato,
        telefone: card.telefone,
        email: card.email,
        nomePet: card.nomePet,
        racaPet: card.racaPet,
        portePet: card.portePet,
        servicoInteresse: card.servicoInteresse,
        origem: 'whatsapp',
      });
      setSelectedCardId(created.id);
    } catch {
      // o hook já exibe o toast de erro
    }
  };

  const handleOpenAddCard = (stageId?: string) => {
    setAddCardDefaultStageId(stageId || activeStages[0]?.id || null);
    setIsAddCardOpen(true);
  };

  const handleOpenCreatePipeline = () => {
    setManageDialogMode('create');
    setIsManageDialogOpen(true);
  };

  const handleOpenEditPipeline = () => {
    setManageDialogMode('edit');
    setIsManageDialogOpen(true);
  };

  const handleQuickMessageOpen = (card: CrmPipelineCard) => {
    setQuickMessageCard(card);
    setQuickMessageText('');
  };

  const handleQuickMessageProceed = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickMessageCard || !quickMessageText.trim()) return;
    setIsPauseDialogOpen(true);
  };

  const handleConfirmPauseAndSend = async (duration: number | null) => {
    if (!quickMessageCard) return;
    const phone = toWhatsappNumber(quickMessageCard.telefone);
    if (!phone) {
      toast.error('Contato sem telefone válido para WhatsApp');
      setIsPauseDialogOpen(false);
      return;
    }

    try {
      await sendText(phone, quickMessageText.trim());
      if (duration !== null) {
        await supabase.functions.invoke('atendimento-controle', {
          body: {
            action: 'pausar',
            sessionId: phone,
            durationSeconds: duration * 60 * 60,
          },
        });
      }
      if (!quickMessageCard.virtualFromConversation) {
        await addActivity.mutateAsync({
          cardId: quickMessageCard.id,
          tipo: 'mensagem',
          descricao: `Mensagem enviada pelo Kanban: "${quickMessageText.trim()}"`,
        });
      }
      setIsPauseDialogOpen(false);
      setQuickMessageCard(null);
      setQuickMessageText('');
      toast.success(`Mensagem enviada para ${quickMessageCard.nomeContato}`);
    } catch {
      setIsPauseDialogOpen(false);
      toast.error('Erro ao enviar mensagem via WhatsApp');
    }
  };

  return (
    <PageContainer className="space-y-4">
      {/* Cabeçalho Principal + Seletor de Pipelines */}
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <div>
            <div className="flex items-center gap-2">
              <Kanban className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold tracking-tight">
                Pipelines de Atendimento, Leads & Marketing
              </h1>
              {modoLocal && (
                <span
                  className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300"
                  title="A migração SQL 20261112100000_crm_pipelines.sql ainda não foi executada no banco; operando com armazenamento local seguro."
                >
                  Modo Local
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {activePipeline?.descricao ||
                'Organize o fluxo de atendimento da clínica, acompanhe leads e conduza campanhas de marketing arrastando contatos entre as etapas.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Popover flutuante com Métricas & Resumo rápido */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  title="Métricas e detalhes rápidos do pipeline em janela flutuante"
                >
                  <BarChart3 className="h-3.5 w-3.5 text-primary" />
                  <span className="hidden sm:inline">Métricas Rápidas</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[340px] sm:w-[380px] p-4 shadow-xl">
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b pb-2">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-primary" />
                      <h4 className="text-sm font-semibold">Resumo do Pipeline</h4>
                    </div>
                    <span className="text-xs text-muted-foreground truncate max-w-[170px]">
                      {activePipeline?.nome}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="rounded-lg border bg-muted/30 p-2.5">
                      <span className="text-[11px] text-muted-foreground">Total Contatos</span>
                      <div className="mt-0.5 flex items-baseline justify-between">
                        <span className="text-lg font-bold tabular-nums">{metricas.totalCards}</span>
                        <span className="text-[11px] font-semibold text-primary">
                          {metricas.valorTotal.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="rounded-lg border bg-muted/30 p-2.5">
                      <span className="text-[11px] text-muted-foreground">No Funil Ativo</span>
                      <div className="mt-0.5 flex items-baseline justify-between">
                        <span className="text-lg font-bold tabular-nums">{metricas.emAndamentoCount}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {activeStages.length} etapas
                        </span>
                      </div>
                    </div>

                    <div className="rounded-lg border bg-muted/30 p-2.5">
                      <span className="text-[11px] text-muted-foreground">Convertidos</span>
                      <div className="mt-0.5 flex items-baseline justify-between">
                        <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                          {metricas.ganhosCount}
                        </span>
                        <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                          {metricas.taxaConversao}% conv.
                        </span>
                      </div>
                    </div>

                    <div
                      className={`rounded-lg border p-2.5 cursor-pointer transition-colors ${
                        apenasAtrasados ? 'border-destructive bg-destructive/10' : 'bg-muted/30 hover:border-amber-500/50'
                      }`}
                      onClick={() => setApenasAtrasados((prev) => !prev)}
                    >
                      <span className="text-[11px] text-muted-foreground">SLA / Follow-up</span>
                      <div className="mt-0.5 flex items-baseline justify-between">
                        <span className={`text-lg font-bold tabular-nums ${metricas.atrasadosSlaCount + metricas.followUpPendenteCount > 0 ? 'text-destructive' : ''}`}>
                          {metricas.atrasadosSlaCount + metricas.followUpPendenteCount}
                        </span>
                        <span className="text-[10px] text-primary underline">
                          {apenasAtrasados ? 'Limpar' : 'Filtrar'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Distribuição de contatos por estágio */}
                  <div className="border-t pt-2 space-y-1.5">
                    <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                      Distribuição por Estágio
                    </span>
                    <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                      {activeStages.map((stage) => {
                        const count = activeCards.filter((c) => c.stageId === stage.id).length;
                        const pct = activeCards.length > 0 ? Math.round((count / activeCards.length) * 100) : 0;
                        return (
                          <div key={stage.id} className="flex items-center justify-between text-xs py-0.5">
                            <div className="flex items-center gap-2 truncate">
                              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: stage.cor }} />
                              <span className="truncate">{stage.nome}</span>
                            </div>
                            <div className="flex items-center gap-2 font-medium tabular-nums text-muted-foreground">
                              <span>{count}</span>
                              <span className="text-[10px] w-8 text-right opacity-70">({pct}%)</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={handleOpenCreatePipeline}
            >
              <Plus className="h-3.5 w-3.5" />
              Novo Pipeline
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={handleOpenEditPipeline}
              disabled={!activePipeline}
            >
              <Settings2 className="h-3.5 w-3.5" />
              Estágios & Roteiro
            </Button>

            <Button
              type="button"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={() => handleOpenAddCard()}
              disabled={!activePipeline}
            >
              <UserPlus className="h-3.5 w-3.5" />
              Adicionar Contato
            </Button>
          </div>
        </div>

        {/* Abas dos Pipelines */}
        <div className="flex items-center gap-2 overflow-x-auto pt-1 border-t">
          {pipelines.map((pipe) => {
            const isSelected = pipe.id === activePipeline?.id;
            const count = cards.filter((c) => c.pipelineId === pipe.id).length;
            return (
              <button
                key={pipe.id}
                type="button"
                onClick={() => setSelectedPipelineId(pipe.id)}
                className={`group flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all shrink-0 ${
                  isSelected
                    ? 'border-primary bg-primary/10 text-primary shadow-sm'
                    : 'border-transparent bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: pipe.cor }}
                />
                <span>{pipe.nome}</span>
                <span className="rounded-full bg-background/80 px-1.5 py-0.2 text-[10px] font-semibold text-foreground/80">
                  {count}
                </span>
                <span className="hidden sm:inline text-[10px] opacity-70">
                  · {PIPELINE_CATEGORIA_LABELS[pipe.categoria]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Acordeon Retrátil de Métricas & Detalhes do Pipeline */}
      <Accordion
        type="single"
        collapsible
        value={isMetricsExpanded ? 'metricas' : ''}
        onValueChange={handleToggleMetrics}
        className="w-full rounded-xl border bg-card shadow-sm overflow-hidden"
      >
        <AccordionItem value="metricas" className="border-b-0 px-3.5">
          <AccordionTrigger className="py-2.5 hover:no-underline text-xs">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs w-full pr-2 text-left">
              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                <BarChart3 className="h-4 w-4 text-primary" />
                <span>Métricas & Detalhes</span>
              </div>

              {/* Resumo compacto exibido mesmo com acordeon fechado */}
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="rounded-md bg-muted px-2 py-0.5 font-medium text-foreground">
                  <strong className="font-bold">{metricas.totalCards}</strong>{' '}
                  {metricas.totalCards === 1 ? 'contato' : 'contatos'}
                </span>
                <span className="rounded-md bg-muted px-2 py-0.5 font-medium text-foreground">
                  {metricas.valorTotal.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                </span>
                <span className="rounded-md bg-muted px-2 py-0.5 text-muted-foreground hidden sm:inline">
                  {metricas.emAndamentoCount} no funil
                </span>
                <span className="rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 font-semibold">
                  {metricas.ganhosCount} conv. ({metricas.taxaConversao}%)
                </span>
                {metricas.atrasadosSlaCount + metricas.followUpPendenteCount > 0 ? (
                  <span className="rounded-md bg-destructive/15 text-destructive px-2 py-0.5 font-semibold flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {metricas.atrasadosSlaCount + metricas.followUpPendenteCount} pendentes
                  </span>
                ) : (
                  <span className="rounded-md bg-muted px-2 py-0.5 text-muted-foreground hidden md:inline">
                    0 atrasados
                  </span>
                )}
              </div>

              <span className="ml-auto text-[11px] text-muted-foreground mr-1 hidden sm:inline">
                {isMetricsExpanded ? 'Recolher detalhes' : 'Expandir métricas'}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-1 pb-3">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 pt-1">
              <div className="rounded-xl border bg-muted/30 p-3 shadow-sm">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Total no Pipeline</span>
                  <Users className="h-4 w-4 text-primary" />
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-2xl font-bold tabular-nums">{metricas.totalCards}</span>
                  <span className="text-xs font-medium text-muted-foreground tabular-nums">
                    {metricas.valorTotal.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </span>
                </div>
              </div>

              <div className="rounded-xl border bg-muted/30 p-3 shadow-sm">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Em Atendimento / Funil</span>
                  <Sparkles className="h-4 w-4 text-sky-500" />
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-2xl font-bold tabular-nums">{metricas.emAndamentoCount}</span>
                  <span className="text-xs text-muted-foreground">
                    {activeStages.length} estágios ativos
                  </span>
                </div>
              </div>

              <div className="rounded-xl border bg-muted/30 p-3 shadow-sm">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Agendados / Convertidos</span>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {metricas.ganhosCount}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <TrendingUp className="h-3 w-3" />
                    {metricas.taxaConversao}% conv.
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setApenasAtrasados((prev) => !prev)}
                className={`rounded-xl border p-3 text-left shadow-sm transition-colors ${
                  apenasAtrasados
                    ? 'border-destructive bg-destructive/10'
                    : 'bg-muted/30 hover:border-amber-500/50'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>SLA Vencido / Follow-up</span>
                  <AlertTriangle
                    className={`h-4 w-4 ${
                      metricas.atrasadosSlaCount + metricas.followUpPendenteCount > 0
                        ? 'text-destructive'
                        : 'text-muted-foreground'
                    }`}
                  />
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-2xl font-bold tabular-nums">
                    {metricas.atrasadosSlaCount + metricas.followUpPendenteCount}
                  </span>
                  <span className="text-[11px] text-primary underline">
                    {apenasAtrasados ? 'Mostrando apenas atrasados' : 'Filtrar pendentes'}
                  </span>
                </div>
              </button>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Barra de Filtros e Controles de Exibição */}
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-sm">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative lg:col-span-2">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar contato, pet, telefone, serviço ou campanha..."
              className="h-8 pl-8 text-xs"
            />
          </div>

          <Select
            value={prioridadeFiltro}
            onValueChange={(v) => setPrioridadeFiltro(v as CardPrioridade | 'todas')}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Prioridade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas" className="text-xs">
                Todas as Prioridades
              </SelectItem>
              {(Object.keys(CARD_PRIORIDADE_LABELS) as CardPrioridade[]).map((p) => (
                <SelectItem key={p} value={p} className="text-xs">
                  Prioridade: {CARD_PRIORIDADE_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={origemFiltro}
            onValueChange={(v) => setOrigemFiltro(v as CardOrigem | 'todas')}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Origem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas" className="text-xs">
                Todas as Origens
              </SelectItem>
              {(Object.keys(CARD_ORIGEM_LABELS) as CardOrigem[]).map((o) => (
                <SelectItem key={o} value={o} className="text-xs">
                  {CARD_ORIGEM_LABELS[o]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={atendenteFiltro} onValueChange={setAtendenteFiltro}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Atendente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos" className="text-xs">
                Todos os Atendentes
              </SelectItem>
              <SelectItem value="sem_atendente" className="text-xs">
                Sem atendente atribuído
              </SelectItem>
              {atendentes.map((a) => (
                <SelectItem key={a.id} value={String(a.id)} className="text-xs">
                  {a.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={tagFiltro} onValueChange={setTagFiltro}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Tag do Cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas" className="text-xs">
                Todas as Tags
              </SelectItem>
              {tags.map((t) => (
                <SelectItem key={t.id} value={String(t.id)} className="text-xs">
                  {t.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>
              Exibindo <strong className="text-foreground">{cardsFiltrados.length}</strong> de{' '}
              <strong className="text-foreground">{activeCards.length}</strong> contatos
            </span>
            {temFiltrosAtivos && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={limparFiltros}
                className="h-6 px-2 text-xs text-destructive hover:bg-destructive/10"
              >
                <FilterX className="mr-1 h-3 w-3" />
                Limpar filtros
              </Button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant={showStageGuides ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2.5 text-xs gap-1.5"
              onClick={() => setShowStageGuides((prev) => !prev)}
              title="Mostrar/ocultar o guia de atendimento no topo de cada coluna"
            >
              <BookOpen className="h-3.5 w-3.5 text-primary" />
              Guia do Atendimento
            </Button>

            <div className="flex items-center rounded-md border p-0.5">
              <Button
                type="button"
                variant={viewMode === 'kanban' ? 'default' : 'ghost'}
                size="sm"
                className="h-6 px-2 text-xs gap-1"
                onClick={() => setViewMode('kanban')}
              >
                <Kanban className="h-3.5 w-3.5" />
                Kanban
              </Button>
              <Button
                type="button"
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                className="h-6 px-2 text-xs gap-1"
                onClick={() => setViewMode('list')}
              >
                <LayoutList className="h-3.5 w-3.5" />
                Lista
              </Button>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={refresh}
              title="Atualizar dados"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </div>

      {/* Quadro Kanban ou Lista */}
      {loading && pipelines.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-xl border bg-card">
          <div className="text-center space-y-2">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-xs text-muted-foreground">Carregando pipelines e estágios...</p>
          </div>
        </div>
      ) : (
        <PipelineKanbanBoard
          stages={activeStages}
          cards={cardsFiltrados}
          viewMode={viewMode}
          showStageGuides={showStageGuides}
          tagsPorCliente={tagsPorCliente}
          abertasPorCliente={abertasPorCliente}
          atendenteById={atendenteById}
          onCardClick={handleCardClick}
          onLoadMore={loadMoreContactsFeed}
          hasMore={hasMoreContactsFeed}
          loadingMore={loadingMoreContactsFeed}
          onAddCardInStage={(stageId) => handleOpenAddCard(stageId)}
          onMoveCard={(cardId, toStageId) => moveCard.mutate({ cardId, toStageId })}
          onQuickMessage={handleQuickMessageOpen}
        />
      )}

      {/* Modal de Criar / Configurar Pipeline e Estágios */}
      <PipelineManageDialog
        open={isManageDialogOpen}
        onOpenChange={setIsManageDialogOpen}
        mode={manageDialogMode}
        pipeline={activePipeline}
        stages={activeStages}
        canDelete={pipelines.length > 1}
        onCreate={(input) => createPipeline.mutateAsync(input)}
        onUpdate={(input) => updatePipeline.mutateAsync(input)}
        onDelete={(id) => deletePipeline.mutateAsync(id)}
        isSaving={createPipeline.isPending || updatePipeline.isPending}
      />

      {/* Modal de Adicionar Contato / Importar em Lote */}
      {activePipeline && (
        <AddCardDialog
          open={isAddCardOpen}
          onOpenChange={setIsAddCardOpen}
          pipelineId={activePipeline.id}
          pipelineNome={activePipeline.nome}
          stages={activeStages}
          defaultStageId={addCardDefaultStageId}
          atendentes={atendentes}
          tags={tags}
          existingClientIdsInPipeline={existingClientIdsInPipeline}
          onCreateCard={(input) => createCard.mutateAsync(input)}
          onImportBatch={(input) => importCardsBatch.mutateAsync(input)}
          isSubmitting={createCard.isPending || importCardsBatch.isPending}
        />
      )}

      {/* Sheet de Detalhes Completos do Card */}
      <CardDetailSheet
        open={Boolean(selectedCard)}
        onOpenChange={(open) => !open && setSelectedCardId(null)}
        card={selectedCard}
        pipelines={pipelines}
        stagesByPipeline={stagesByPipeline}
        atendentes={atendentes}
        activities={selectedCard ? activitiesByCardId.get(selectedCard.id) || [] : []}
        onMoveCard={(input) => moveCard.mutateAsync(input)}
        onUpdateCard={(input) => updateCard.mutateAsync(input)}
        onDeleteCard={(cardId) => deleteCard.mutateAsync(cardId)}
        onAddActivity={(input) => addActivity.mutateAsync(input)}
      />

      {/* Modal de Mensagem Rápida WhatsApp */}
      <Dialog
        open={Boolean(quickMessageCard)}
        onOpenChange={(open) => !open && setQuickMessageCard(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Send className="h-4 w-4 text-emerald-600" />
              Mensagem Rápida — {quickMessageCard?.nomeContato}
            </DialogTitle>
            <DialogDescription>
              Envie uma mensagem diretamente para o WhatsApp ({quickMessageCard?.telefone}).
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleQuickMessageProceed} className="space-y-3">
            <Textarea
              value={quickMessageText}
              onChange={(e) => setQuickMessageText(e.target.value)}
              placeholder="Digite a mensagem que será enviada ao cliente..."
              rows={4}
              required
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setQuickMessageCard(null)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={!quickMessageText.trim()}>
                Continuar Envio
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <PauseDurationDialog
        isOpen={isPauseDialogOpen}
        onOpenChange={setIsPauseDialogOpen}
        onConfirm={handleConfirmPauseAndSend}
      />
    </PageContainer>
  );
};

export default PipelinesPage;
