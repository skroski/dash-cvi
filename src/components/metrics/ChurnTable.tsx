import React from 'react';
import { useNavigate } from 'react-router-dom';
import { UserX, ArrowRight, Phone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChurnConversation, formatDurationShort } from '@/hooks/useAtendimentoMetrics';

interface ChurnTableProps {
  data: ChurnConversation[];
  loading?: boolean;
}

const ChurnTable: React.FC<ChurnTableProps> = ({ data, loading = false }) => {
  const navigate = useNavigate();
  // Já vem ordenado pelo maior tempo sem resposta.
  const rows = data.slice(0, 10);

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CardTitle className="flex items-center gap-2 text-base text-foreground">
            <UserX className="h-5 w-5 text-destructive" />
            Churn de Atendimento
          </CardTitle>
          {!loading && data.length > 0 && (
            <Badge variant="destructive" className="text-xs py-0.5 px-2 font-medium">
              {data.length}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Atribuídas a um atendente, sem resposta humana há mais de 24h e ainda não fechadas
        </p>
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
              <UserX className="h-6 w-6 text-emerald-500" />
            </div>
            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Nenhum churn no momento</p>
            <p className="text-xs mt-1">Todos os atendimentos atribuídos tiveram resposta nas últimas 24h.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground">Cliente</th>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground hidden sm:table-cell">
                    Atendente
                  </th>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground hidden md:table-cell">
                    Última msg do cliente
                  </th>
                  <th className="text-right py-2.5 px-3 text-xs font-semibold text-muted-foreground">Sem resposta há</th>
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
                    <td className="py-2.5 px-3 text-muted-foreground text-xs hidden sm:table-cell">{row.atendente}</td>
                    <td className="py-2.5 px-3 text-muted-foreground text-xs hidden md:table-cell">
                      {row.lastClientMessageAt.toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <Badge className="bg-destructive/20 text-destructive font-semibold text-[10px] py-0 px-2">
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

export default ChurnTable;
