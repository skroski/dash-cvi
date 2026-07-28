import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Headset, ArrowRight, Phone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { OpenAttendance, formatDurationShort } from '@/hooks/useAtendimentoMetrics';

interface OpenAttendancesTableProps {
  data: OpenAttendance[];
  loading?: boolean;
}

const OpenAttendancesTable: React.FC<OpenAttendancesTableProps> = ({ data, loading = false }) => {
  const navigate = useNavigate();
  // Já vem ordenado por tempo em aberto (mais antigo primeiro).
  const rows = data.slice(0, 10);

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CardTitle className="flex items-center gap-2 text-base text-foreground">
            <Headset className="h-5 w-5 text-primary" />
            Em Atendimento Humano
          </CardTitle>
          {!loading && data.length > 0 && (
            <Badge variant="secondary" className="text-xs py-0.5 px-2 font-medium">
              {data.length}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Atendimentos abertos com a equipe, do que espera há mais tempo para o mais recente
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
              <Headset className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">Nenhum atendimento humano em andamento</p>
            <p className="text-xs mt-1">Atribua uma conversa a um atendente para acompanhá-la aqui.</p>
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
                    Departamento
                  </th>
                  <th className="text-right py-2.5 px-3 text-xs font-semibold text-muted-foreground">Aberto há</th>
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
                    <td className="py-2.5 px-3 hidden md:table-cell">
                      <Badge
                        variant="outline"
                        className="text-[10px] py-0 px-2 font-normal"
                        style={row.departamentoCor ? { borderColor: row.departamentoCor, color: row.departamentoCor } : undefined}
                      >
                        {row.departamento}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 text-right text-xs font-medium tabular-nums text-foreground">
                      {formatDurationShort(row.waitingMinutes)}
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
              Ver todos no painel de conversas
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default OpenAttendancesTable;
