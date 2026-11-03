import { useMemo, useState } from 'react';
import { Bot, Eye, FlaskConical, MessageSquareText, RefreshCw, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import EmptyState from '@/components/shared/EmptyState';
import { MessagePeriod } from '@/hooks/useReminders';
import { cn } from '@/lib/utils';
import { capitalizarNome, juntarLista, nomesDosPets } from '@/lib/reminderMessage';
import { ReminderMessage, ReminderMessageStatus } from '@/types/reminder';
import { STATUS_META, StatusBadge, TRIGGER_LABEL, formatDateBR, formatPhone, formatTime } from './reminderUi';

const PERIODS: { value: MessagePeriod; label: string }[] = [
  { value: 'hoje', label: 'Hoje' },
  { value: '7dias', label: 'Últimos 7 dias' },
  { value: '30dias', label: 'Últimos 30 dias' },
  { value: 'todos', label: 'Todas' },
];

interface MessagesTabProps {
  messages: ReminderMessage[];
  loading: boolean;
  period: MessagePeriod;
  onPeriodChange: (period: MessagePeriod) => void;
  onOpen: (message: ReminderMessage) => void;
  onRefresh: () => void;
}

export function SourceBadge({ message }: { message: ReminderMessage }) {
  if (message.trigger === 'teste') {
    return (
      <Badge variant="outline" className="gap-1 font-normal">
        <FlaskConical className="h-3 w-3" aria-hidden="true" />
        Teste
      </Badge>
    );
  }
  if (!message.textSource) return null;
  return (
    <Badge variant="outline" className="gap-1 font-normal">
      {message.textSource === 'ia' ? (
        <>
          <Bot className="h-3 w-3" aria-hidden="true" />
          IA
        </>
      ) : message.textSource === 'manual' ? (
        <>
          <MessageSquareText className="h-3 w-3" aria-hidden="true" />
          Revisado
        </>
      ) : (
        <>
          <MessageSquareText className="h-3 w-3" aria-hidden="true" />
          Frase {(message.exampleIndex ?? 0) + 1}
        </>
      )}
    </Badge>
  );
}

const MessagesTab = ({ messages, loading, period, onPeriodChange, onOpen, onRefresh }: MessagesTabProps) => {
  const [statusFilter, setStatusFilter] = useState<'todos' | ReminderMessageStatus>('todos');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return messages.filter((message) => {
      if (statusFilter !== 'todos' && message.status !== statusFilter) return false;
      if (!term) return true;
      return [message.ownerName, message.phone, ...message.petNames]
        .some((value) => value.toLowerCase().includes(term));
    });
  }, [messages, statusFilter, search]);

  const summary = useMemo(() => {
    const count = (status: ReminderMessageStatus) => messages.filter((m) => m.status === status).length;
    return { queued: count('pendente') + count('processando'), sent: count('enviado'), failed: count('falha') };
  }, [messages]);

  return (
    <Card className="shadow-sm">
      <CardHeader className="gap-3 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Mensagens enviadas e na fila</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Uma mensagem por tutor por dia. {summary.queued} na fila · {summary.sent} enviada(s) ·{' '}
              {summary.failed} com falha. Atualiza sozinho.
            </p>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11"
            onClick={onRefresh}
            aria-label="Atualizar mensagens"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} aria-hidden="true" />
          </Button>
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_180px_180px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar tutor, pet ou telefone"
              className="min-h-11 pl-9"
              aria-label="Buscar mensagens"
            />
          </div>
          <Select value={period} onValueChange={(value) => onPeriodChange(value as MessagePeriod)}>
            <SelectTrigger className="min-h-11" aria-label="Período">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as 'todos' | ReminderMessageStatus)}
          >
            <SelectTrigger className="min-h-11" aria-label="Status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {(Object.keys(STATUS_META) as ReminderMessageStatus[]).map((status) => (
                <SelectItem key={status} value={status}>
                  {STATUS_META[status].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {loading ? (
          <div className="space-y-3 p-5">
            {[0, 1, 2].map((item) => (
              <Skeleton key={item} className="h-20 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<MessageSquareText />}
            title={messages.length === 0 ? 'Nenhuma mensagem neste período' : 'Nada encontrado com esses filtros'}
            description={
              messages.length === 0
                ? 'As mensagens aparecem aqui quando entram na fila, no horário de cada regra.'
                : 'Altere a busca ou os filtros.'
            }
            className="py-10"
          />
        ) : (
          <ul className="divide-y">
            {filtered.map((message) => (
              <li key={message.id}>
                <button
                  type="button"
                  onClick={() => onOpen(message)}
                  className="grid w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none md:grid-cols-[150px_220px_1fr_auto]"
                >
                  <div className="text-sm tabular-nums">
                    <p className="font-medium">
                      {message.status === 'enviado' && message.sentAt
                        ? formatTime(message.sentAt)
                        : formatTime(message.scheduledFor)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {message.status === 'enviado' ? 'enviado' : 'programado'} · {formatDateBR(message.sendDay)}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{capitalizarNome(message.ownerName)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {juntarLista(nomesDosPets(message.petNames)) || 'Pet não informado'} ·{' '}
                      {formatPhone(message.phone)}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {message.services.join(', ') || 'Sem serviço'} · atendimento{' '}
                      {formatDateBR(message.appointmentDate)}
                    </p>
                  </div>
                  <p className="line-clamp-3 whitespace-pre-wrap text-sm leading-5 text-muted-foreground">
                    {message.text ??
                      (message.status === 'pendente' || message.status === 'processando'
                        ? 'O texto é escrito pela IA pouco antes do envio.'
                        : message.error ?? 'Sem texto.')}
                  </p>
                    <div className="flex flex-row items-start gap-1.5 md:flex-col md:items-end">
                    <StatusBadge status={message.status} />
                    <div className="flex flex-wrap gap-1">
                      {message.botoesConfirmacao && (
                        <Badge
                          variant="outline"
                          className="border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-normal text-[10px]"
                        >
                          2 Botões
                        </Badge>
                      )}
                      <SourceBadge message={message} />
                      {message.trigger === 'manual' && (
                        <Badge variant="outline" className="font-normal">
                          {TRIGGER_LABEL.manual}
                        </Badge>
                      )}
                    </div>
                    <span className="hidden items-center gap-1 text-xs text-primary md:inline-flex">
                      <Eye className="h-3 w-3" aria-hidden="true" />
                      Detalhes
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default MessagesTab;
