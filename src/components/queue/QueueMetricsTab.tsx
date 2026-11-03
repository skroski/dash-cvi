import { useMemo, useState } from 'react';
import {
  Clock,
  CheckCircle2,
  Users,
  UserX,
  XCircle,
  Timer,
  BarChart3,
  Calendar,
  Building2,
  Tag,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { QueueItem, QueueRoom, QueueService } from '@/types/vetbotsModules';

interface QueueMetricsTabProps {
  items: QueueItem[];
  services: QueueService[];
  rooms: QueueRoom[];
}

function formatMinutes(mins: number): string {
  if (isNaN(mins) || mins <= 0) return '0 min';
  if (mins < 60) return `${Math.round(mins)} min`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return `${h}h ${m}m`;
}

export default function QueueMetricsTab({ items, services, rooms }: QueueMetricsTabProps) {
  const [period, setPeriod] = useState<'today' | '7d' | '30d'>('today');
  const [selectedRoom, setSelectedRoom] = useState<string>('all');
  const [selectedService, setSelectedService] = useState<string>('all');

  // Filtra itens pelo período selecionado
  const filteredItems = useMemo(() => {
    const now = new Date();
    let cutoff: Date;

    if (period === 'today') {
      cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    } else if (period === '7d') {
      cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else {
      cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return items.filter((item) => {
      const arr = new Date(item.arrivedAt);
      if (arr < cutoff) return false;
      if (selectedRoom !== 'all' && item.roomId !== selectedRoom) return false;
      if (selectedService !== 'all' && item.serviceId !== selectedService) return false;
      return true;
    });
  }, [items, period, selectedRoom, selectedService]);

  // Cálculos de métricas
  const metrics = useMemo(() => {
    const totalEntries = filteredItems.length;
    const finishedItems = filteredItems.filter((i) => i.status === 'finalizado');
    const noShowItems = filteredItems.filter((i) => i.status === 'ausente');
    const cancelledItems = filteredItems.filter((i) => i.status === 'cancelado');

    // Tempo médio de espera (Chegada até chamado/início)
    const waitTimes: number[] = [];
    filteredItems.forEach((i) => {
      const callOrStart = i.calledAt || i.startedAt;
      if (callOrStart && i.arrivedAt) {
        const diffMs = new Date(callOrStart).getTime() - new Date(i.arrivedAt).getTime();
        const mins = diffMs / 60000;
        if (mins >= 0 && mins < 1440) {
          waitTimes.push(mins);
        }
      }
    });
    const avgWait = waitTimes.length > 0
      ? waitTimes.reduce((acc, v) => acc + v, 0) / waitTimes.length
      : 0;

    // Tempo médio de atendimento (Início até finalização)
    const serviceTimes: number[] = [];
    finishedItems.forEach((i) => {
      const start = i.startedAt || i.calledAt;
      if (start && i.finishedAt) {
        const diffMs = new Date(i.finishedAt).getTime() - new Date(start).getTime();
        const mins = diffMs / 60000;
        if (mins >= 0 && mins < 1440) {
          serviceTimes.push(mins);
        }
      }
    });
    const avgService = serviceTimes.length > 0
      ? serviceTimes.reduce((acc, v) => acc + v, 0) / serviceTimes.length
      : 0;

    // Volume por Fila / Serviço
    const byService: Record<string, number> = {};
    filteredItems.forEach((i) => {
      byService[i.serviceId] = (byService[i.serviceId] || 0) + 1;
    });

    // Volume por Horário (07h às 22h)
    const byHour: Record<number, number> = {};
    for (let h = 7; h <= 21; h++) byHour[h] = 0;
    filteredItems.forEach((i) => {
      const h = new Date(i.arrivedAt).getHours();
      if (h >= 7 && h <= 21) {
        byHour[h] = (byHour[h] || 0) + 1;
      }
    });

    return {
      totalEntries,
      finishedCount: finishedItems.length,
      noShowCount: noShowItems.length,
      cancelledCount: cancelledItems.length,
      avgWait,
      avgService,
      byService,
      byHour,
    };
  }, [filteredItems]);

  const maxHourCount = Math.max(1, ...Object.values(metrics.byHour));

  return (
    <div className="space-y-4">
      {/* Barra de Filtros dos Indicadores */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-lg border bg-card p-3 shadow-sm">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-semibold">Período:</span>
          <div className="flex items-center gap-1 rounded-md bg-muted/60 p-0.5">
            <button
              type="button"
              onClick={() => setPeriod('today')}
              className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                period === 'today'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => setPeriod('7d')}
              className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                period === '7d'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              7 dias
            </button>
            <button
              type="button"
              onClick={() => setPeriod('30d')}
              className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                period === '30d'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              30 dias
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Filtro de Fila/Serviço */}
          <div className="flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5 text-muted-foreground" />
            <Select value={selectedService} onValueChange={setSelectedService}>
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue placeholder="Todas as filas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as filas</SelectItem>
                {services.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name || s.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filtro de Sala/Unidade */}
          <div className="flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
            <Select value={selectedRoom} onValueChange={setSelectedRoom}>
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue placeholder="Todas as salas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as salas</SelectItem>
                {rooms.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name || r.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Grid de Cards de Indicadores */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Entradas */}
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Total de Entradas</span>
              <div className="grid h-7 w-7 place-items-center rounded-md bg-primary/10 text-primary">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold">{metrics.totalEntries}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Senhas emitidas no período</p>
          </CardContent>
        </Card>

        {/* Finalizados */}
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Atendimentos Concluídos</span>
              <div className="grid h-7 w-7 place-items-center rounded-md bg-emerald-500/10 text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {metrics.finishedCount}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {metrics.totalEntries > 0
                ? `${Math.round((metrics.finishedCount / metrics.totalEntries) * 100)}% das entradas`
                : 'Nenhum atendimento'}
            </p>
          </CardContent>
        </Card>

        {/* Tempo Médio de Espera */}
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Tempo Médio de Espera</span>
              <div className="grid h-7 w-7 place-items-center rounded-md bg-amber-500/10 text-amber-600">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">
              {formatMinutes(metrics.avgWait)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Da chegada até a chamada</p>
          </CardContent>
        </Card>

        {/* Tempo Médio de Atendimento */}
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Tempo Médio de Atendimento</span>
              <div className="grid h-7 w-7 place-items-center rounded-md bg-blue-500/10 text-blue-600">
                <Timer className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold text-blue-600 dark:text-blue-400">
              {formatMinutes(metrics.avgService)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Do início à finalização</p>
          </CardContent>
        </Card>
      </div>

      {/* Perdas e Desistências */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center justify-between rounded-lg border border-amber-200/60 bg-amber-50/40 p-3.5 dark:border-amber-950/50 dark:bg-amber-950/15">
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300">
              <UserX className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-amber-950 dark:text-amber-200">
                Não Compareceram (Ausentes)
              </p>
              <p className="text-[11px] text-muted-foreground">
                Pacientes que foram chamados mas não compareceram
              </p>
            </div>
          </div>
          <span className="text-xl font-bold text-amber-800 dark:text-amber-300">
            {metrics.noShowCount}
          </span>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-rose-200/60 bg-rose-50/40 p-3.5 dark:border-rose-950/50 dark:bg-rose-950/15">
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300">
              <XCircle className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-rose-950 dark:text-rose-200">
                Cancelamentos
              </p>
              <p className="text-[11px] text-muted-foreground">
                Senhas canceladas antes ou durante o atendimento
              </p>
            </div>
          </div>
          <span className="text-xl font-bold text-rose-800 dark:text-rose-300">
            {metrics.cancelledCount}
          </span>
        </div>
      </div>

      {/* Gráficos de Distribuição por Fila e Horário */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Distribuição por Fila / Serviço */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Volume por Tipo de Atendimento</CardTitle>
            <CardDescription className="text-xs">
              Distribuição de entradas em cada fila
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {services.map((s) => {
              const count = metrics.byService[s.id] || 0;
              const pct = metrics.totalEntries > 0 ? (count / metrics.totalEntries) * 100 : 0;
              return (
                <div key={s.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">{s.name || s.nome}</span>
                    <span className="text-muted-foreground font-mono">
                      {count} ({Math.round(pct)}%)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}

            {services.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                Nenhum tipo de atendimento cadastrado.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Volume por Horário */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Volume por Horário do Dia</CardTitle>
            <CardDescription className="text-xs">
              Chegadas registradas entre 07h e 21h
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between gap-1 h-36 pt-6">
              {Object.entries(metrics.byHour).map(([hStr, count]) => {
                const h = parseInt(hStr, 10);
                const heightPct = (count / maxHourCount) * 100;
                return (
                  <div key={h} className="flex-1 flex flex-col items-center gap-1 group">
                    <span className="text-[10px] text-muted-foreground font-mono opacity-0 group-hover:opacity-100 transition">
                      {count}
                    </span>
                    <div className="w-full rounded-t bg-muted group-hover:bg-primary/80 transition flex items-end justify-center h-24">
                      <div
                        className="w-full rounded-t bg-primary transition-all duration-300"
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-muted-foreground font-mono">
                      {h}h
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
