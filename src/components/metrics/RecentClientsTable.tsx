import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Users, 
  ArrowRight, 
  Search, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  ExternalLink 
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Client {
  id: number;
  name: string;
  phone: string;
  pets: number;
  lastVisit: string;
}

interface RecentClientsTableProps {
  clients: Client[];
  loading?: boolean;
}

type SortField = 'name' | 'phone' | 'pets' | 'lastVisit';
type SortDirection = 'asc' | 'desc';

const parseDate = (dStr: string) => {
  const parts = dStr.split('/');
  if (parts.length === 3) {
    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
  }
  return 0;
};

const RecentClientsTable: React.FC<RecentClientsTableProps> = ({ clients, loading = false }) => {
  const navigate = useNavigate();
  
  // Card states — ordena por data de cadastro (mais recente primeiro) por padrão
  const [cardSearch, setCardSearch] = useState('');
  const [cardSortField, setCardSortField] = useState<SortField | null>('lastVisit');
  const [cardSortDirection, setCardSortDirection] = useState<SortDirection>('desc');

  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogSearch, setDialogSearch] = useState('');
  const [dialogSortField, setDialogSortField] = useState<SortField | null>('lastVisit');
  const [dialogSortDirection, setDialogSortDirection] = useState<SortDirection>('desc');

  // Helper for sorting
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

  const processList = (data: Client[], search: string, field: SortField | null, direction: SortDirection) => {
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

        if (field === 'lastVisit') {
          const aTime = parseDate(aVal as string);
          const bTime = parseDate(bVal as string);
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
            <CardTitle className="flex items-center gap-2 text-foreground text-lg">
              <Users className="h-5 w-5 text-primary" />
              Clientes Recentes
            </CardTitle>
            
            <div className="relative w-full sm:w-60">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente..."
                value={cardSearch}
                onChange={(e) => setCardSearch(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col space-y-3">
              <div className="w-full h-8 bg-muted animate-pulse rounded" />
              <div className="w-full h-12 bg-muted animate-pulse rounded" />
              <div className="w-full h-12 bg-muted animate-pulse rounded" />
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead 
                      className="cursor-pointer select-none group py-3 text-xs font-semibold"
                      onClick={() => handleSort('name', false)}
                    >
                      <div className="flex items-center">
                        Nome {getSortIcon('name', cardSortField, cardSortDirection)}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer select-none group py-3 text-xs font-semibold"
                      onClick={() => handleSort('phone', false)}
                    >
                      <div className="flex items-center">
                        Telefone {getSortIcon('phone', cardSortField, cardSortDirection)}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer select-none group py-3 text-xs font-semibold"
                      onClick={() => handleSort('pets', false)}
                    >
                      <div className="flex items-center">
                        Pets {getSortIcon('pets', cardSortField, cardSortDirection)}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer select-none group py-3 text-xs font-semibold"
                      onClick={() => handleSort('lastVisit', false)}
                    >
                      <div className="flex items-center">
                        Cadastro {getSortIcon('lastVisit', cardSortField, cardSortDirection)}
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedCardClients.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-xs">
                        Nenhum cliente recente encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    // Display top 5 clients on the card
                    filteredAndSortedCardClients.slice(0, 5).map((client) => (
                      <TableRow 
                        key={client.id}
                        className="cursor-pointer hover:bg-muted/60 transition-colors"
                        onClick={() => navigate(`/chats?search=${client.phone || client.name}`)}
                        title="Clique para abrir chat deste cliente"
                      >
                        <TableCell className="font-medium text-xs py-3">{client.name}</TableCell>
                        <TableCell className="text-xs py-3 font-mono">{client.phone || '-'}</TableCell>
                        <TableCell className="text-xs py-3">
                          <Badge variant="outline" className="bg-accent text-accent-foreground hover:bg-accent/80 text-[10px] py-0 px-2">
                            {client.pets} {client.pets !== 1 ? 'pets' : 'pet'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs py-3 text-muted-foreground">{client.lastVisit}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
          
          <div className="mt-4 flex flex-col sm:flex-row justify-center items-center gap-3">
            <Button 
              variant="outline" 
              className="text-xs flex items-center gap-2 w-full sm:w-auto h-9"
              onClick={() => setIsDialogOpen(true)}
            >
              Ver todos (Métricas)
              <ArrowRight className="h-4 w-4" />
            </Button>
            
            <Button 
              variant="ghost" 
              className="text-xs flex items-center gap-2 text-muted-foreground hover:text-foreground w-full sm:w-auto h-9"
              onClick={() => navigate('/clients')}
            >
              Gerenciar Clientes
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Dialog View All */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-6 ">
          <DialogHeader className="pb-3 border-b border-border">
            <DialogTitle className="text-xl flex items-center gap-2 font-bold text-foreground">
              <Users className="h-5 w-5 text-primary" />
              Lista Completa de Clientes Recentes ({clients.length})
            </DialogTitle>
            <DialogDescription className="text-xs">
              Visualize, filtre e ordene todos os clientes recentemente cadastrados no banco de dados.
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
              Encontrados: {filteredAndSortedDialogClients.length}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto rounded-md border border-border">
            <Table>
              <TableHeader className="bg-muted/80 sticky top-0 z-10">
                <TableRow>
                  <TableHead 
                    className="cursor-pointer select-none group text-xs font-semibold py-3"
                    onClick={() => handleSort('name', true)}
                  >
                    <div className="flex items-center">
                      Nome {getSortIcon('name', dialogSortField, dialogSortDirection)}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer select-none group text-xs font-semibold py-3"
                    onClick={() => handleSort('phone', true)}
                  >
                    <div className="flex items-center">
                      Telefone {getSortIcon('phone', dialogSortField, dialogSortDirection)}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer select-none group text-xs font-semibold py-3"
                    onClick={() => handleSort('pets', true)}
                  >
                    <div className="flex items-center">
                      Pets {getSortIcon('pets', dialogSortField, dialogSortDirection)}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer select-none group text-xs font-semibold py-3"
                    onClick={() => handleSort('lastVisit', true)}
                  >
                    <div className="flex items-center">
                      Cadastro {getSortIcon('lastVisit', dialogSortField, dialogSortDirection)}
                    </div>
                  </TableHead>
                  <TableHead className="text-right text-xs font-semibold py-3">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedDialogClients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                      Nenhum cliente encontrado com os filtros atuais.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAndSortedDialogClients.map((client) => (
                    <TableRow 
                      key={client.id}
                      className="hover:bg-muted/50"
                    >
                      <TableCell className="font-medium text-sm">{client.name}</TableCell>
                      <TableCell className="text-sm font-mono">{client.phone || '-'}</TableCell>
                      <TableCell className="text-sm">
                        <Badge variant="outline" className="bg-accent text-accent-foreground">
                          {client.pets} {client.pets !== 1 ? 'pets' : 'pet'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{client.lastVisit}</TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 text-xs text-primary flex items-center gap-1 ml-auto"
                          onClick={() => {
                            setIsDialogOpen(false);
                            navigate(`/chats?search=${client.phone || client.name}`);
                          }}
                        >
                          Chat <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex justify-end gap-3 pt-3 border-t border-border">
            <Button 
              variant="outline" 
              onClick={() => setIsDialogOpen(false)}
              className="text-xs"
            >
              Fechar
            </Button>
            <Button 
              className="text-xs bg-primary text-white"
              onClick={() => {
                setIsDialogOpen(false);
                navigate('/clients');
              }}
            >
              Gerenciador Completo
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default RecentClientsTable;
