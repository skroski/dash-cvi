import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Hourglass, ArrowRight, Phone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { WaitingClient, formatDurationShort } from '@/hooks/useAtendimentoMetrics';

interface WaitingClientsTableProps {
  data: WaitingClient[];
  loading?: boolean;
  /** Falso quando a tag "Atendimento Humano" não existe no catálogo. */
  tagEncontrada?: boolean;
}

const ORIGEM_LABEL: Record<WaitingClient['origem'], string> = {
  tag: 'Pediu humano',
  atribuido: 'Atribuído',
  ambos: 'Pediu + atribuído',
};

/** Severidade pelo tempo de espera: até 1h ok, até 24h atenção, acima disso crítico. */
function severityClass(minutes: number): string {
  if (minutes < 60) return 'bg-muted text-muted-foreground';
  if (minutes < 1440) return 'bg-warning/10 text-warning';
  return 'bg-destructive/20 text-destructive font-semibold';
}

const WaitingClientsTable: React.FC<WaitingClientsTableProps> = ({
  data,
  loading = false,
  tagEncontrada = true,
}) => {
  const navigate = useNavigate();
  // Já vem ordenado por tempo de espera (maior primeiro).
  const rows = data.slice(0, 10);

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CardTitle className="flex items-center gap-2 text-base text-foreground">
            <Hourglass className="h-5 w-5 text-warning" />
            Aguardando Atendimento Humano
          </CardTitle>
          {!loading && data.length > 0 && (
            <Badge variant="destructive" className="text-xs py-0.5 px-2 font-medium">
              {data.length}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Quem pediu atendimento humano (tag) ou já foi atribuído, ainda sem resposta e com a conversa aberta
        </p>
        {!tagEncontrada && (
          <p className="text-xs text-warning mt-1">
            Tag "Atendimento Humano" não encontrada no catálogo — a lista mostra apenas conversas atribuídas.
          </p>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-3">
              <Hourglass className="h-6 w-6 text-emerald-500" />
            </div>
            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Ninguém na fila</p>
            <p className="text-xs mt-1">Nenhum cliente aguardando atendimento humano agora.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground">Cliente</th>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground hidden sm:table-cell">
                    Origem
                  </th>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground hidden md:table-cell">
                    Última msg
                  </th>
                  <th className="text-right py-2.5 px-3 text-xs font-semibold text-muted-foreground">Esperando há</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.sessionId}
                    className="border-b border-border/60 hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/chats?select=${row.sessionId}`)}
                    title="Clique para abrir esta conversa"
                  >
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-foreground text-xs max-w-[140px] truncate">{row.clientName}</div>
                      <div className="text-muted-foreground font-mono text-[11px] flex items-center gap-1 sm:hidden">
                        <Phone className="h-3 w-3" />
                        {row.phone}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 hidden sm:table-cell">
                      <Badge variant="outline" className="text-[10px] py-0 px-2 font-normal">
                        {ORIGEM_LABEL[row.origem]}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground text-xs hidden md:table-cell">
                      {row.lastClientMessageAt.toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <Badge className={`text-[10px] py-0 px-2 font-normal ${severityClass(row.idleMinutes)}`}>
                        {formatDurationShort(row.idleMinutes)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data.length > rows.length && (
          <div className="mt-4 flex justify-center">
            <button
              className="text-xs flex items-center gap-2 text-primary hover:underline"
              onClick={() => navigate('/chats?filter=unanswered')}
            >
              Ver todos ({data.length})
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WaitingClientsTable;
