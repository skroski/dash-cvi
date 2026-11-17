import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CheckSquare,
  ChevronDown,
  Clock,
  CreditCard,
  Mail,
  MapPin,
  Dog,
  FileText,
  GripVertical,
  Headset,
  Megaphone,
  MessageSquare,
  UserRound,
  Phone,
  Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  CARD_ORIGEM_LABELS,
  CARD_PRIORIDADE_LABELS,
  CrmPipelineCard,
  CrmPipelineStage,
} from '@/types/pipeline';
import { ClientPendencia, Tag } from '@/types/crm';
import { Atendente } from '@/types/atendimento';
import TagBadge from '@/components/tags/TagBadge';
import { formatPhone } from '@/lib/formatters';
import {
  avaliarSlaCard,
  montarLinkConversa,
  montarLinkProntuario,
} from '@/lib/pipelineDefaults';

interface PipelineCardItemProps {
  card: CrmPipelineCard;
  stage: CrmPipelineStage;
  prevStage: CrmPipelineStage | null;
  nextStage: CrmPipelineStage | null;
  clientTags: Tag[];
  openPendencias: ClientPendencia[];
  atendente: Atendente | undefined;
  onCardClick: (card: CrmPipelineCard) => void;
  onMoveStage: (cardId: string, toStageId: string) => void;
  onQuickMessage: (card: CrmPipelineCard) => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, card: CrmPipelineCard) => void;
  onDragEnd: (e: React.DragEvent<HTMLDivElement>) => void;
}

const PRIORIDADE_BADGE_CLASSES: Record<CrmPipelineCard['prioridade'], string> = {
  baixa: 'bg-muted text-muted-foreground',
  media: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  alta: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  urgente: 'bg-destructive/15 text-destructive font-semibold',
};

export const PipelineCardItem: React.FC<PipelineCardItemProps> = ({
  card,
  stage,
  prevStage,
  nextStage,
  clientTags,
  openPendencias,
  atendente,
  onCardClick,
  onMoveStage,
  onQuickMessage,
  onDragStart,
  onDragEnd,
}) => {
  const [expanded, setExpanded] = useState(false);
  const sla = avaliarSlaCard(card.movidoEm, stage.slaHoras, stage.tipo);
  const completedChecks = card.checklist.filter((c) => c.concluido).length;
  const totalChecks = card.checklist.length;
  const chatUrl = montarLinkConversa(card);
  const prontuarioUrl = montarLinkProntuario(card);

  const followUpVencido =
    card.proximaAcaoEm &&
    stage.tipo !== 'ganho' &&
    stage.tipo !== 'perdido' &&
    Date.parse(card.proximaAcaoEm) <= Date.now();

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, card)}
      onDragEnd={onDragEnd}
      onClick={() => setExpanded((v) => !v)}
      aria-expanded={expanded}
      role="article"
      aria-label={`Contato ${card.nomeContato} na etapa ${stage.nome}`}
      className={`kanban-card group relative rounded-lg border bg-card p-3 shadow-sm transition-all hover:shadow-md hover:border-primary/40 cursor-pointer ${
        sla.atrasado
          ? 'border-l-4 border-l-destructive'
          : sla.alertaProximo
          ? 'border-l-4 border-l-amber-500'
          : ''
      }`}
    >
      {/* Topo: Alça de arraste, Prioridade, Origem e Movimento rápido */}
      <div className="flex items-center justify-between gap-1.5 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="kanban-drag-handle inline-flex h-6 w-5 items-center justify-center rounded text-muted-foreground/70 hover:bg-muted hover:text-foreground"
            title="Arraste para mover de coluna"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </span>

          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
              PRIORIDADE_BADGE_CLASSES[card.prioridade]
            }`}
          >
            {CARD_PRIORIDADE_LABELS[card.prioridade]}
          </span>

          <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground truncate">
            {CARD_ORIGEM_LABELS[card.origem] || card.origem}
          </span>
        </div>

        {/* Botões rápidos de avançar/voltar estágio (acessíveis por teclado e mouse) */}
        <div
          className="kanban-card-actions flex items-center gap-0.5 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={() => setExpanded((v) => !v)}
            title={expanded ? 'Recolher informações' : 'Expandir informações do cliente'}
            aria-label={expanded ? 'Recolher card' : 'Expandir card'}
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            />
          </Button>
          {prevStage && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={() => onMoveStage(card.id, prevStage.id)}
              title={`Voltar para: ${prevStage.nome}`}
              aria-label={`Mover ${card.nomeContato} para etapa anterior: ${prevStage.nome}`}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
          )}
          {nextStage && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-primary hover:bg-primary/10 hover:text-primary"
              onClick={() => onMoveStage(card.id, nextStage.id)}
              title={`Avançar para: ${nextStage.nome}`}
              aria-label={`Avançar ${card.nomeContato} para próxima etapa: ${nextStage.nome}`}
            >
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Nome do Contato e Telefone */}
      <div className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-semibold leading-tight text-foreground group-hover:text-primary transition-colors">
            {card.nomeContato}
          </h4>
          {card.valorEstimado > 0 && (
            <span className="shrink-0 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 tabular-nums">
              {card.valorEstimado.toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              })}
            </span>
          )}
        </div>

        {card.telefone && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
            <Phone className="h-3 w-3 shrink-0" />
            {formatPhone(card.telefone)}
          </p>
        )}

        {card.ultimaMensagem && (
          <p className="flex items-start gap-1 text-[11px] text-muted-foreground">
            <MessageSquare className="mt-0.5 h-3 w-3 shrink-0" />
            <span className="line-clamp-1 flex-1">{card.ultimaMensagem}</span>
            {card.ultimoContatoRotulo && (
              <span className="shrink-0 tabular-nums opacity-80">{card.ultimoContatoRotulo}</span>
            )}
          </p>
        )}
      </div>

      {/* Dados do Pet e Serviço */}
      {(card.nomePet || card.servicoInteresse || card.campanha) && (
        <div className="mt-2.5 space-y-1.5 rounded-md bg-muted/50 p-2 text-xs">
          {card.nomePet && (
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <Dog className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="truncate">
                {card.nomePet}
                {card.racaPet ? ` · ${card.racaPet}` : ''}
                {card.portePet ? ` (${card.portePet})` : ''}
              </span>
            </div>
          )}

          {card.servicoInteresse && (
            <div className="text-[11px] text-muted-foreground truncate">
              <strong className="text-foreground/80">Interesse:</strong> {card.servicoInteresse}
            </div>
          )}

          {card.campanha && (
            <div className="flex items-center gap-1 text-[11px] text-violet-700 dark:text-violet-300 font-medium truncate">
              <Megaphone className="h-3 w-3 shrink-0" />
              {card.campanha}
            </div>
          )}
        </div>
      )}

      {/* Tags do Cliente + Pendências */}
      {(clientTags.length > 0 || card.tagsCustom.length > 0 || openPendencias.length > 0) && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {clientTags.slice(0, 3).map((tag) => (
            <TagBadge key={tag.id} tag={tag} />
          ))}
          {card.tagsCustom.slice(0, 2).map((t) => (
            <span
              key={t}
              className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
            >
              {t}
            </span>
          ))}
          {openPendencias.length > 0 && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-medium text-warning"
              title={openPendencias.map((p) => p.descricao).join(', ')}
            >
              <AlertTriangle className="h-2.5 w-2.5" />
              {openPendencias.length} {openPendencias.length === 1 ? 'pendência' : 'pendências'}
            </span>
          )}
        </div>
      )}

      {/* Próxima Ação / Checklist / SLA / Atendente */}
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-1.5 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 ${
              sla.atrasado
                ? 'font-semibold text-destructive'
                : sla.alertaProximo
                ? 'font-medium text-amber-600 dark:text-amber-400'
                : ''
            }`}
            title={
              stage.slaHoras
                ? `Meta da etapa: até ${stage.slaHoras}h`
                : 'Tempo nesta etapa'
            }
          >
            <Clock className="h-3 w-3" />
            {sla.rotuloTempo}
            {sla.atrasado && stage.slaHoras ? ` (SLA ${stage.slaHoras}h)` : ''}
          </span>

          {totalChecks > 0 && (
            <span
              className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                completedChecks === totalChecks
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                  : 'bg-muted text-muted-foreground'
              }`}
              title="Progresso do roteiro de atendimento"
            >
              <CheckSquare className="h-3 w-3" />
              {completedChecks}/{totalChecks}
            </span>
          )}
        </div>

        {atendente && (
          <span
            className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary truncate max-w-[120px]"
            title={`Atendente responsável: ${atendente.nome}`}
          >
            <Headset className="h-2.5 w-2.5 shrink-0" />
            {atendente.nome}
          </span>
        )}
      </div>

      {card.proximaAcao && (
        <div
          className={`mt-2 flex items-center gap-1.5 rounded px-2 py-1 text-[11px] ${
            followUpVencido
              ? 'bg-destructive/10 text-destructive font-medium'
              : 'bg-amber-500/10 text-amber-800 dark:text-amber-200'
          }`}
        >
          <CalendarClock className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{card.proximaAcao}</span>
        </div>
      )}

      {/* Detalhes expandidos (mesmos dados da tela de Clientes) */}
      <div
        className={`grid transition-all duration-200 ease-out ${
          expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="overflow-hidden">
          {expanded && (
            <div className="mt-2.5 space-y-3 rounded-md border bg-muted/30 p-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Cliente
                </span>
                {card.clientId ? (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      card.clienteAtivo === false
                        ? 'bg-muted text-muted-foreground'
                        : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                    }`}
                  >
                    {card.clienteAtivo === false ? 'Inativo' : 'Ativo'}
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                    Sem cadastro
                  </span>
                )}
              </div>

              <dl className="grid grid-cols-[16px_1fr] items-start gap-x-2 gap-y-2.5">
                <Mail className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                <div className="min-w-0">
                  <dd className="truncate font-medium">{card.email || 'Não informado'}</dd>
                  <dt className="text-[10px] text-muted-foreground">Email</dt>
                </div>

                <Phone className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                <div className="min-w-0">
                  <dd className="font-medium">
                    {card.telefone ? formatPhone(card.telefone) : 'Não informado'}
                  </dd>
                  <dt className="text-[10px] text-muted-foreground">Telefone</dt>
                </div>

                <UserRound className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                <div className="min-w-0">
                  <dd className="truncate font-medium">{card.cpfCnpj || 'Não informado'}</dd>
                  <dt className="text-[10px] text-muted-foreground">CPF/CNPJ</dt>
                </div>

                <CreditCard className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                <div className="min-w-0">
                  <dd className="truncate font-medium">{card.asaasCustomerId || 'Não informado'}</dd>
                  <dt className="text-[10px] text-muted-foreground">ID Asaas</dt>
                </div>

                {card.endereco && (
                  <>
                    <MapPin className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                    <div className="min-w-0">
                      <dd className="font-medium">{card.endereco}</dd>
                      <dt className="text-[10px] text-muted-foreground">Endereço</dt>
                    </div>
                  </>
                )}
              </dl>

              <div className="space-y-2 border-t pt-2.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Pet
                </span>
                <dl className="grid grid-cols-3 gap-2">
                  <div className="min-w-0">
                    <dd className="truncate font-medium">{card.nomePet || '—'}</dd>
                    <dt className="text-[10px] text-muted-foreground">Nome</dt>
                  </div>
                  <div className="min-w-0">
                    <dd className="truncate font-medium">{card.racaPet || '—'}</dd>
                    <dt className="text-[10px] text-muted-foreground">Raça</dt>
                  </div>
                  <div className="min-w-0">
                    <dd className="truncate font-medium">{card.portePet || '—'}</dd>
                    <dt className="text-[10px] text-muted-foreground">Porte</dt>
                  </div>
                </dl>
              </div>

              {card.observacoes && (
                <div className="border-t pt-2.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Observações
                  </span>
                  <p className="mt-1 whitespace-pre-wrap">{card.observacoes}</p>
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 w-full text-[11px]"
                onClick={() => onCardClick(card)}
              >
                Abrir detalhes completos
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Rodapé de Ações Rápidas: Abrir Conversa, Enviar Mensagem, Prontuário e Avançar */}
      <div
        className="mt-2.5 flex items-center justify-between gap-1 border-t pt-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-[11px] gap-1 text-primary border-primary/30 hover:bg-primary/10"
            asChild
            title="Abrir conversa no painel de atendimento"
          >
            <Link to={chatUrl}>
              <MessageSquare className="h-3.5 w-3.5" />
              Conversa
            </Link>
          </Button>

          {card.telefone && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700"
              onClick={() => onQuickMessage(card)}
              title="Enviar mensagem rápida no WhatsApp"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-primary"
            asChild
            title="Abrir Prontuário IA deste cliente/pet"
          >
            <Link to={prontuarioUrl}>
              <FileText className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        {nextStage && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px] gap-1 text-muted-foreground hover:text-primary"
            onClick={() => onMoveStage(card.id, nextStage.id)}
            title={`Avançar para ${nextStage.nome}`}
          >
            Avançar
            <ArrowRight className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
};
