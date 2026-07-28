import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ArrowRight, Phone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FinalizedAttendance, formatDurationShort } from '@/hooks/useAtendimentoMetrics';

interface FinalizedAttendancesTableProps {
  data: FinalizedAttendance[];
  loading?: boolean;
}

const FinalizedAttendancesTable: React.FC<FinalizedAttendancesTableProps> = ({ data, loading = false }) => {
  const navigate = useNavigate();
  // Já vem ordenado por encerramento (mais recente primeiro).
  const rows = data.slice(0, 10);

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CardTitle className="flex items-center gap-2 text-base text-foreground">
            <CheckCircle2 className="h-5 w-5 text-success" />
            Atendimentos Encerrados
          </CardTitle>
          {!loading && data.length > 0 && (
            <Badge variant="secondary" className="text-xs py-0.5 px-2 font-medium">
              {data.length}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Encerrados no período, do mais recente para o mais antigo
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
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <CheckCircle2 className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">Nenhum atendimento finalizado no período</p>
            <p className="text-xs mt-1">Encerramentos de atendimento aparecerão aqui.</p>
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
                    Duração
                  </th>
                  <th className="text-right py-2.5 px-3 text-xs font-semibold text-muted-foreground">Finalizado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
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
                    <td className="py-2.5 px-3 text-xs tabular-nums text-muted-foreground hidden md:table-cell">
                      {formatDurationShort(row.durationMinutes)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-xs text-muted-foreground">
                      {row.finishedAt.toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
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
              onClick={() => navigate('/chats')}
            >
              Ver conversas
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FinalizedAttendancesTable;
