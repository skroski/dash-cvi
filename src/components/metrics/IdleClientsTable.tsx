import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  AlertTriangle, 
  Phone, 
  Search, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  ArrowRight 
} from 'lucide-react';
import { IdleClient } from '@/hooks/useChatMetrics';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface IdleClientsTableProps {
  clients: IdleClient[];
  loading?: boolean;
}

type SortField = 'name' | 'phone' | 'lastMessageTime' | 'idleMinutes';
type SortDirection = 'asc' | 'desc';

function formatIdleTime(minutes: number): { label: string; severity: 'low' | 'medium' | 'high' | 'critical' } {
  if (minutes < 60) return { label: `${minutes}min`, severity: 'low' };
  if (minutes < 360) return { label: `${Math.floor(minutes / 60)}h ${minutes % 60}min`, severity: 'medium' };
  if (minutes < 1440) return { label: `${Math.floor(minutes / 60)}h`, severity: 'high' };
  return { label: `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h`, severity: 'critical' };
}

const severityStyles = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-warning/10 text-warning',
  high: 'bg-destructive/10 text-destructive',
  critical: 'bg-destructive/20 text-destructive font-semibold',
};

const IdleClientsTable: React.FC<IdleClientsTableProps> = ({ clients, loading = false }) => {
  const navigate = useNavigate();
  
  // Card states — ordena por tempo ocioso (mais tempo sem resposta primeiro)
  const [cardSearch, setCardSearch] = useState('');
  const [cardSortField, setCardSortField] = useState<SortField | null>('idleMinutes');
  const [cardSortDirection, setCardSortDirection] = useState<SortDirection>('desc');

  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogSearch, setDialogSearch] = useState('');
  const [dialogSortField, setDialogSortField] = useState<SortField | null>('idleMinutes');
  const [dialogSortDirection, setDialogSortDirection] = useState<SortDirection>('desc');

  // Sorting helper
  const handleSort = (field: SortField, isDialog: boolean) => {
    const currentField = isDialog ? dialogSortField : cardSortField;
    const currentDirection = isDialog ? dialogSortDirection : cardSortDirection;
    const setField = isDialog ? setDialogSortField : setCardSortField;
    const setDirection = isDialog ? setDialogSortDirection : setCardSortDirection;

    if (currentField === field) {
      if (currentDirection === 'asc') {
        setDirection('desc');
      } else {
        setField(null);
      }
    } else {
      setField(field);
      setDirection('asc');
    }
  };

  const getSortIcon = (field: SortField, currentField: SortField | null, direction: SortDirection) => {
    if (currentField !== field) return <ArrowUpDown className="ml-1 h-3.5 w-3.5 opacity-40 group-hover:opacity-100 transition-opacity" />;
    return direction === 'asc' 
      ? <ArrowUp className="ml-1 h-3.5 w-3.5 text-primary" />
      : <ArrowDown className="ml-1 h-3.5 w-3.5 text-primary" />;
  };

  const processList = (data: IdleClient[], search: string, field: SortField | null, direction: SortDirection) => {
    // Filter
    const result = data.filter(client => 
      (client.name?.toLowerCase() || '').includes(search.toLowerCase()) ||
      (client.phone || '').includes(search)
    );

    // Sort
    if (field) {
      result.sort((a, b) => {
        const aVal = a[field];
        const bVal = b[field];

        if (field === 'lastMessageTime') {
          const aTime = new Date(aVal as Date).getTime();
          const bTime = new Date(bVal as Date).getTime();
          return direction === 'asc' ? aTime - bTime : bTime - aTime;
        }

        if (typeof aVal === 'string') {
          return direction === 'asc' 
            ? aVal.localeCompare(bVal as string)
            : (bVal as string).localeCompare(aVal);
        }

        if (typeof aVal === 'number') {
          return direction === 'asc'
            ? (aVal as number) - (bVal as number)
            : (bVal as number) - (aVal as number);
        }

        return 0;
      });
    }

    return result;
  };

  const filteredAndSortedCardClients = processList(clients, cardSearch, cardSortField, cardSortDirection);
  const filteredAndSortedDialogClients = processList(clients, dialogSearch, dialogSortField, dialogSortDirection);

  return (
    <>
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-2">
              <CardTitle className="flex items-center gap-2 text-foreground text-base">
                <AlertTriangle className="h-5 w-5 text-warning" />
                Clientes Sem Resposta
              </CardTitle>
              {!loading && clients.length > 0 && (
                <Badge variant="destructive" className="text-xs py-0.5 px-2 font-medium">
                  {clients.length}
                </Badge>
              )}
            </div>
            
            <div className="relative w-full sm:w-60">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente ocioso..."
                value={cardSearch}
                onChange={(e) => setCardSearch(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Clientes cuja última mensagem foi deles (sem resposta do bot ainda)
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : filteredAndSortedCardClients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-3">
                <AlertTriangle className="h-6 w-6 text-emerald-500" />
              </div>
              <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Todos respondidos!</p>
              <p className="text-xs mt-1">Nenhum cliente aguardando resposta no momento.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th 
                      className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground cursor-pointer select-none group"
                      onClick={() => handleSort('name', false)}
                    >
                      <div className="flex items-center">
                        Cliente {getSortIcon('name', cardSortField, cardSortDirection)}
                      </div>
                    </th>
                    <th 
                      className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground cursor-pointer select-none group hidden sm:table-cell"
                      onClick={() => handleSort('phone', false)}
                    >
                      <div className="flex items-center">
                        <Phone className="h-3 w-3 inline mr-1" />Telefone {getSortIcon('phone', cardSortField, cardSortDirection)}
                      </div>
                    </th>
                    <th 
                      className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground cursor-pointer select-none group"
                      onClick={() => handleSort('lastMessageTime', false)}
                    >
                      <div className="flex items-center">
                        Última Msg {getSortIcon('lastMessageTime', cardSortField, cardSortDirection)}
                      </div>
                    </th>
                    <th 
                      className="text-right py-2.5 px-3 text-xs font-semibold text-muted-foreground cursor-pointer select-none group"
                      onClick={() => handleSort('idleMinutes', false)}
                    >
                      <div className="flex items-center justify-end">
                        Ocioso há {getSortIcon('idleMinutes', cardSortField, cardSortDirection)}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedCardClients.slice(0, 10).map((client) => {
                    const { label, severity } = formatIdleTime(client.idleMinutes);
                    return (
                      <tr
                        key={client.sessionId}
                        className="border-b border-border/60 hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => navigate(`/chats?select=${client.sessionId}`)}
                        title="Clique para abrir esta conversa"
                      >
                        <td className="py-2.5 px-3 font-medium text-foreground text-xs max-w-[120px] truncate">
                          {client.name}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground font-mono text-[11px] hidden sm:table-cell">
                          {client.phone}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground text-xs">
                          {client.lastMessageTime.toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <Badge className={`text-[10px] py-0 px-2 font-normal ${severityStyles[severity]}`}>
                            {label}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          
          {clients.length > 10 && (
            <div className="mt-4 flex justify-center">
              <Button 
                variant="outline" 
                className="text-xs flex items-center gap-2 h-9"
                onClick={() => setIsDialogOpen(true)}
              >
                Ver todos sem resposta ({clients.length})
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog View All */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-6">
          <DialogHeader className="pb-3 border-b">
            <DialogTitle className="text-xl flex items-center gap-2 font-bold text-foreground">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Lista de Clientes Aguardando Resposta ({clients.length})
            </DialogTitle>
            <DialogDescription className="text-xs">
              Todos os clientes que enviaram mensagem e ainda não foram respondidos, ordenados por ociosidade.
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-between items-center my-4 gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou telefone..."
                value={dialogSearch}
                onChange={(e) => setDialogSearch(e.target.value)}
                className="pl-10 h-10 text-sm"
              />
            </div>
            <div className="text-xs text-muted-foreground whitespace-nowrap">
              Aguardando: {filteredAndSortedDialogClients.length}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/80 sticky top-0 z-10">
                <tr className="border-b border-border">
                  <th 
                    className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground cursor-pointer select-none group"
                    onClick={() => handleSort('name', true)}
                  >
                    <div className="flex items-center">
                      Cliente {getSortIcon('name', dialogSortField, dialogSortDirection)}
                    </div>
                  </th>
                  <th 
                    className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground cursor-pointer select-none group"
                    onClick={() => handleSort('phone', true)}
                  >
                    <div className="flex items-center">
                      Telefone {getSortIcon('phone', dialogSortField, dialogSortDirection)}
                    </div>
                  </th>
                  <th 
                    className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground cursor-pointer select-none group"
                    onClick={() => handleSort('lastMessageTime', true)}
                  >
                    <div className="flex items-center">
                      Última Mensagem {getSortIcon('lastMessageTime', dialogSortField, dialogSortDirection)}
                    </div>
                  </th>
                  <th 
                    className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground cursor-pointer select-none group"
                    onClick={() => handleSort('idleMinutes', true)}
                  >
                    <div className="flex items-center">
                      Tempo Ocioso {getSortIcon('idleMinutes', dialogSortField, dialogSortDirection)}
                    </div>
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredAndSortedDialogClients.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-muted-foreground">
                      Nenhum cliente sem resposta encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedDialogClients.map((client) => {
                    const { label, severity } = formatIdleTime(client.idleMinutes);
                    return (
                      <tr 
                        key={client.sessionId}
                        className="hover:bg-muted/50"
                      >
                        <td className="py-3 px-4 font-medium text-sm">{client.name}</td>
                        <td className="py-3 px-4 text-sm font-mono">{client.phone}</td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {client.lastMessageTime.toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          <Badge className={`text-xs py-0.5 px-2 ${severityStyles[severity]}`}>
                            {label}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 text-xs text-primary flex items-center gap-1 ml-auto"
                            onClick={() => {
                              setIsDialogOpen(false);
                              navigate(`/chats?select=${client.sessionId}`);
                            }}
                          >
                            Abrir Chat <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex justify-end gap-3 pt-3 border-t">
            <Button 
              variant="outline" 
              onClick={() => setIsDialogOpen(false)}
              className="text-xs"
            >
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default IdleClientsTable;
