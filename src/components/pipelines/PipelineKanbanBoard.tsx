import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Clock,
  Dog,
  FileText,
  HelpCircle,
  Loader2,
  MessageSquare,
  Phone,
  Plus,
  Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  CARD_ORIGEM_LABELS,
  CARD_PRIORIDADE_LABELS,
  CrmPipelineCard,
  CrmPipelineStage,
} from '@/types/pipeline';
import { ClientPendencia, Tag } from '@/types/crm';
import { Atendente } from '@/types/atendimento';
import { PipelineCardItem } from './PipelineCardItem';
import {
  avaliarSlaCard,
  montarLinkConversa,
  montarLinkProntuario,
} from '@/lib/pipelineDefaults';
import { formatPhone } from '@/lib/formatters';

interface PipelineKanbanBoardProps {
  stages: CrmPipelineStage[];
  cards: CrmPipelineCard[];
  viewMode: 'kanban' | 'list';
  showStageGuides: boolean;
  tagsPorCliente: Map<number, Tag[]>;
  abertasPorCliente: Map<number, ClientPendencia[]>;
  atendenteById: Map<number, Atendente>;
  onCardClick: (card: CrmPipelineCard) => void;
  onAddCardInStage: (stageId: string) => void;
  onMoveCard: (cardId: string, toStageId: string) => void;
  onQuickMessage: (card: CrmPipelineCard) => void;
  /** Carregamento incremental da 1ª coluna (contatos por ordem de conversa) */
  onLoadMore?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
}

const InfiniteSentinel: React.FC<{
  root: React.RefObject<HTMLDivElement>;
  onVisible: () => void;
  disabled: boolean;
}> = ({ root, onVisible, disabled }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || disabled) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onVisible();
      },
      { root: root.current, rootMargin: '240px 0px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [root, onVisible, disabled]);
  return <div ref={ref} aria-hidden className="h-px w-full shrink-0" />;
};

export const PipelineKanbanBoard: React.FC<PipelineKanbanBoardProps> = ({
  stages,
  cards,
  viewMode,
  showStageGuides,
  tagsPorCliente,
  abertasPorCliente,
  atendenteById,
  onCardClick,
  onAddCardInStage,
  onMoveCard,
  onQuickMessage,
  onLoadMore,
  hasMore = false,
  loadingMore = false,
}) => {
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState('');
  const firstColumnScrollRef = useRef<HTMLDivElement>(null);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, card: CrmPipelineCard) => {
    setDraggedCardId(card.id);
    e.dataTransfer.setData('text/plain', card.id);
    e.dataTransfer.effectAllowed = 'move';
    if (typeof document !== 'undefined') {
      document.documentElement.classList.add('is-dragging-kanban');
    }
  };

  const handleDragEnd = () => {
    setDraggedCardId(null);
    setDragOverStageId(null);
    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove('is-dragging-kanban');
    }
  };

  const handleDragOverColumn = (e: React.DragEvent<HTMLDivElement>, stageId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverStageId !== stageId) {
      setDragOverStageId(stageId);
    }
  };

  const handleDropOnColumn = (e: React.DragEvent<HTMLDivElement>, targetStage: CrmPipelineStage) => {
    e.preventDefault();
    const cardId = e.dataTransfer.getData('text/plain') || draggedCardId;
    setDragOverStageId(null);
    setDraggedCardId(null);
    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove('is-dragging-kanban');
    }
    if (!cardId) return;

    const card = cards.find((c) => c.id === cardId);
    if (!card || card.stageId === targetStage.id) return;

    onMoveCard(card.id, targetStage.id);
    setLiveAnnouncement(`${card.nomeContato} movido para a etapa ${targetStage.nome}.`);
  };

  const handleMoveWithAnnounce = (cardId: string, toStageId: string) => {
    const card = cards.find((c) => c.id === cardId);
    const targetStage = stages.find((s) => s.id === toStageId);
    onMoveCard(cardId, toStageId);
    if (card && targetStage) {
      setLiveAnnouncement(`${card.nomeContato} movido para a etapa ${targetStage.nome}.`);
    }
  };

  if (viewMode === 'list') {
    const stageById = new Map(stages.map((s) => [s.id, s]));
    return (
      <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
        <div className="sr-only" aria-live="polite">
          {liveAnnouncement}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs font-semibold">Contato / Tutor</TableHead>
              <TableHead className="text-xs font-semibold">Pet & Interesse</TableHead>
              <TableHead className="text-xs font-semibold">Etapa no Pipeline</TableHead>
              <TableHead className="text-xs font-semibold">Prioridade / Origem</TableHead>
              <TableHead className="text-xs font-semibold">Tempo na Etapa</TableHead>
              <TableHead className="text-xs font-semibold">Valor</TableHead>
              <TableHead className="text-xs font-semibold">Atendente</TableHead>
              <TableHead className="text-right text-xs font-semibold">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cards.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-28 text-center text-xs text-muted-foreground">
                  Nenhum contato encontrado neste pipeline com os filtros atuais.
                </TableCell>
              </TableRow>
            ) : (
              cards.map((card) => {
                const st = stageById.get(card.stageId) || stages[0];
                const sla = avaliarSlaCard(card.movidoEm, st?.slaHoras, st?.tipo);
                const atendente = card.atendenteId
                  ? atendenteById.get(card.atendenteId)
                  : undefined;

                return (
                  <TableRow
                    key={card.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => onCardClick(card)}
                  >
                    <TableCell className="py-2.5">
                      <div className="font-semibold text-xs text-foreground">
                        {card.nomeContato}
                      </div>
                      {card.telefone && (
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
                          <Phone className="h-3 w-3" />
                          {formatPhone(card.telefone)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="py-2.5 text-xs">
                      {card.nomePet ? (
                        <div className="flex items-center gap-1 font-medium">
                          <Dog className="h-3.5 w-3.5 text-primary" />
                          {card.nomePet} {card.racaPet ? `(${card.racaPet})` : ''}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                      {card.servicoInteresse && (
                        <div className="text-[11px] text-muted-foreground">
                          {card.servicoInteresse}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="py-2.5" onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={card.stageId}
                        onValueChange={(newStageId) =>
                          handleMoveWithAnnounce(card.id, newStageId)
                        }
                      >
                        <SelectTrigger className="h-8 w-[185px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {stages.map((s) => (
                            <SelectItem key={s.id} value={s.id} className="text-xs">
                              <span className="flex items-center gap-2">
                                <span
                                  className="h-2 w-2 rounded-full"
                                  style={{ backgroundColor: s.cor }}
                                />
                                {s.nome}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="py-2.5 text-xs">
                      <span className="font-medium">
                        {CARD_PRIORIDADE_LABELS[card.prioridade]}
                      </span>
                      <div className="text-[11px] text-muted-foreground">
                        {CARD_ORIGEM_LABELS[card.origem]}
                        {card.campanha ? ` · ${card.campanha}` : ''}
                      </div>
                    </TableCell>
                    <TableCell className="py-2.5 text-xs">
                      <span
                        className={
                          sla.atrasado
                            ? 'font-semibold text-destructive'
                            : 'text-muted-foreground'
                        }
                      >
                        {sla.rotuloTempo}
                      </span>
                    </TableCell>
                    <TableCell className="py-2.5 text-xs tabular-nums font-medium">
                      {card.valorEstimado > 0
                        ? card.valorEstimado.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })
                        : '-'}
                    </TableCell>
                    <TableCell className="py-2.5 text-xs">
                      {atendente ? atendente.nome : '-'}
                    </TableCell>
                    <TableCell
                      className="py-2.5 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1 text-primary"
                          asChild
                        >
                          <Link to={montarLinkConversa(card)}>
                            <MessageSquare className="h-3.5 w-3.5" />
                            Conversa
                          </Link>
                        </Button>
                        {card.telefone && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-emerald-600"
                            onClick={() => onQuickMessage(card)}
                            title="Mensagem rápida"
                          >
                            <Send className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          asChild
                          title="Prontuário IA"
                        >
                          <Link to={montarLinkProntuario(card)}>
                            <FileText className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div
      className="kanban-scroller min-h-[calc(100vh-290px)] items-start"
      role="region"
      aria-label="Quadro Kanban de Pipelines"
    >
      <div className="sr-only" aria-live="polite">
        {liveAnnouncement}
      </div>

      {stages.map((stage, stageIdx) => {
        const stageCards = cards
          .filter((c) => c.stageId === stage.id)
          .sort((a, b) =>
            stageIdx === 0
              ? (b.latestMessageId || 0) - (a.latestMessageId || 0) ||
                Date.parse(b.ultimoContatoEm || b.updatedAt) -
                  Date.parse(a.ultimoContatoEm || a.updatedAt)
              : a.ordem - b.ordem || b.updatedAt.localeCompare(a.updatedAt)
          );
        const stageTotalValue = stageCards.reduce(
          (acc, c) => acc + (Number(c.valorEstimado) || 0),
          0
        );
        const prevStage = stageIdx > 0 ? stages[stageIdx - 1] : null;
        const nextStage = stageIdx < stages.length - 1 ? stages[stageIdx + 1] : null;
        const isDropTarget = dragOverStageId === stage.id;

        return (
          <div
            key={stage.id}
            onDragOver={(e) => handleDragOverColumn(e, stage.id)}
            onDragLeave={() => {
              if (dragOverStageId === stage.id) setDragOverStageId(null);
            }}
            onDrop={(e) => handleDropOnColumn(e, stage)}
            className={`kanban-column flex w-[315px] shrink-0 flex-col rounded-xl border bg-muted/35 transition-colors ${
              isDropTarget ? 'ring-2 ring-primary bg-primary/5 border-primary/50' : ''
            }`}
          >
            {/* Faixa Superior Colorida da Coluna */}
            <div
              className="h-1.5 w-full rounded-t-xl"
              style={{ backgroundColor: stage.cor }}
            />

            {/* Cabeçalho da Coluna */}
            <div className="border-b bg-card/70 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: stage.cor }}
                  />
                  <h3 className="truncate text-sm font-semibold text-foreground">
                    {stage.nome}
                  </h3>
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-bold text-foreground tabular-nums">
                    {stageCards.length}
                  </span>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-primary"
                  onClick={() => onAddCardInStage(stage.id)}
                  title={`Adicionar contato em ${stage.nome}`}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>
                  {stageTotalValue > 0
                    ? stageTotalValue.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })
                    : 'Sem valor estimado'}
                </span>

                {stage.slaHoras && (
                  <span
                    className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium"
                    title={`Meta de atendimento nesta etapa: até ${stage.slaHoras}h`}
                  >
                    <Clock className="h-2.5 w-2.5" />
                    SLA {stage.slaHoras}h
                  </span>
                )}
              </div>

              {/* Guia Operacional da Etapa para orientar o atendente */}
              {showStageGuides && stage.descricao && (
                <div className="rounded-md border border-primary/20 bg-primary/5 px-2.5 py-2 text-[11px] leading-snug text-foreground/85">
                  <div className="flex items-center gap-1 font-semibold text-primary mb-0.5">
                    <BookOpen className="h-3 w-3 shrink-0" />
                    Guia da etapa:
                  </div>
                  {stage.descricao}
                </div>
              )}
            </div>

            {/* Lista de Cards da Coluna */}
            <div
              ref={stageIdx === 0 ? firstColumnScrollRef : undefined}
              className="flex flex-1 flex-col gap-2.5 p-2.5 min-h-[260px] max-h-[calc(100vh-380px)] overflow-y-auto"
            >
              {stageCards.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed p-5 text-center text-muted-foreground">
                  <HelpCircle className="mb-1.5 h-5 w-5 opacity-40" />
                  <p className="text-xs font-medium">Nenhum contato nesta etapa</p>
                  <p className="mt-0.5 text-[11px] opacity-80">
                    Arraste um card para cá ou clique abaixo para adicionar.
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-2 h-7 text-xs gap-1 text-primary"
                    onClick={() => onAddCardInStage(stage.id)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Adicionar contato
                  </Button>
                </div>
              ) : (
                stageCards.map((card, idx) => (
                  <div
                    key={card.id}
                    className={ idx === stageCards.length - 1 ? 'mb-3' : '' }
                  >
                    <PipelineCardItem
                      card={card}
                      stage={stage}
                      prevStage={prevStage}
                      nextStage={nextStage}
                      clientTags={
                        card.clientId ? tagsPorCliente.get(card.clientId) || [] : []
                      }
                      openPendencias={
                        card.clientId ? abertasPorCliente.get(card.clientId) || [] : []
                      }
                      atendente={
                        card.atendenteId ? atendenteById.get(card.atendenteId) : undefined
                      }
                      onCardClick={onCardClick}
                      onMoveStage={handleMoveWithAnnounce}
                      onQuickMessage={onQuickMessage}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                    />
                  </div>
                ))
              )}

              {stageIdx === 0 && onLoadMore && (
                <>
                  <InfiniteSentinel
                    root={firstColumnScrollRef}
                    onVisible={onLoadMore}
                    disabled={!hasMore || loadingMore}
                  />
                  {loadingMore && (
                    <div className="flex items-center justify-center gap-2 py-2 text-[11px] text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Carregando mais contatos...
                    </div>
                  )}
                  {!hasMore && stageCards.length > 0 && (
                    <p className="py-2 text-center text-[10px] text-muted-foreground/70">
                      Todos os contatos carregados
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
