import React from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Contact } from '@/types/client';
import { ClientPendencia, Tag } from '@/types/crm';
import TagBadge from '@/components/tags/TagBadge';
import {
  Edit2,
  MessageSquare,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { SortField, SortDirection } from '@/hooks/useClientManagement';

interface ClientsTableProps {
  contacts: Contact[];
  isLoading: boolean;
  searchTerm?: string;
  tagsPorCliente?: Map<number, Tag[]>;
  abertasPorCliente?: Map<number, ClientPendencia[]>;
  sortField?: SortField | null;
  sortDirection?: SortDirection;
  onSort?: (field: SortField) => void;
  onContactClick: (contact: Contact) => void;
  onEditClick: (contact: Contact) => void;
  onMessageClick: (contact: Contact) => void;
  onDeleteClick: (contact: Contact) => void;
}

const parseDate = (dStr: string) => {
  if (!dStr || dStr === 'Desconhecido') return 0;
  const parts = dStr.split('/');
  if (parts.length === 3) {
    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
  }
  return 0;
};

const ClientsTable = ({
  contacts,
  isLoading,
  searchTerm = '',
  tagsPorCliente,
  abertasPorCliente,
  sortField: externalSortField,
  sortDirection: externalSortDirection,
  onSort,
  onContactClick,
  onEditClick,
  onMessageClick,
  onDeleteClick
}: ClientsTableProps) => {
  const [internalSortField, setInternalSortField] = React.useState<SortField | null>(null);
  const [internalSortDirection, setInternalSortDirection] = React.useState<SortDirection>('asc');

  const currentSortField = onSort ? (externalSortField ?? null) : internalSortField;
  const currentSortDirection = onSort ? (externalSortDirection ?? 'asc') : internalSortDirection;

  const handleSort = (field: SortField) => {
    if (onSort) {
      onSort(field);
    } else {
      if (internalSortField === field) {
        if (internalSortDirection === 'asc') {
          setInternalSortDirection('desc');
        } else {
          setInternalSortField(null);
        }
      } else {
        setInternalSortField(field);
        setInternalSortDirection('asc');
      }
    }
  };

  const getSortIcon = (field: SortField) => {
    if (currentSortField !== field) return <ArrowUpDown className="ml-1.5 h-3.5 w-3.5 opacity-40 group-hover:opacity-100 transition-opacity" />;
    return currentSortDirection === 'asc' 
      ? <ArrowUp className="ml-1.5 h-3.5 w-3.5 text-primary" />
      : <ArrowDown className="ml-1.5 h-3.5 w-3.5 text-primary" />;
  };

  const sortedContacts = React.useMemo(() => {
    let result = [...contacts];
    
    // If onSort is provided, sorting is done server-side
    if (!onSort) {
      if (searchTerm) {
        result = result.filter(contact =>
          contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (contact.email && contact.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (contact.petName && contact.petName.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (contact.phone && contact.phone.includes(searchTerm))
        );
      }

      if (currentSortField) {
        result.sort((a, b) => {
          const aVal = a[currentSortField] || '';
          const bVal = b[currentSortField] || '';

          if (currentSortField === 'lastContact') {
            return currentSortDirection === 'asc' 
              ? parseDate(aVal) - parseDate(bVal)
              : parseDate(bVal) - parseDate(aVal);
          }

          if (typeof aVal === 'string') {
            return currentSortDirection === 'asc'
              ? aVal.localeCompare(bVal)
              : bVal.localeCompare(aVal);
          }
          return 0;
        });
      }
    }
    
    return result;
  }, [contacts, searchTerm, currentSortField, currentSortDirection, onSort]);

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead 
              className="w-[220px] cursor-pointer select-none group text-xs font-semibold py-3"
              onClick={() => handleSort('name')}
            >
              <div className="flex items-center">
                Nome {getSortIcon('name')}
              </div>
            </TableHead>
            <TableHead 
              className="cursor-pointer select-none group text-xs font-semibold py-3"
              onClick={() => handleSort('email')}
            >
              <div className="flex items-center">
                Email {getSortIcon('email')}
              </div>
            </TableHead>
            <TableHead 
              className="cursor-pointer select-none group text-xs font-semibold py-3"
              onClick={() => handleSort('phone')}
            >
              <div className="flex items-center">
                Telefone {getSortIcon('phone')}
              </div>
            </TableHead>
            <TableHead
              className="cursor-pointer select-none group text-xs font-semibold py-3"
              onClick={() => handleSort('petName')}
            >
              <div className="flex items-center">
                Nome do Pet {getSortIcon('petName')}
              </div>
            </TableHead>
            <TableHead className="text-xs font-semibold py-3">Tags</TableHead>
            <TableHead className="text-xs font-semibold py-3">Pendências</TableHead>
            <TableHead
              className="cursor-pointer select-none group text-xs font-semibold py-3"
              onClick={() => handleSort('status')}
            >
              <div className="flex items-center">
                Status {getSortIcon('status')}
              </div>
            </TableHead>
            <TableHead 
              className="cursor-pointer select-none group text-xs font-semibold py-3"
              onClick={() => handleSort('lastContact')}
            >
              <div className="flex items-center">
                Último Contato {getSortIcon('lastContact')}
              </div>
            </TableHead>
            <th className="py-3 px-4 text-center text-xs font-semibold text-muted-foreground w-[140px]">Ações</th>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={9} className="h-24 text-center">
                <div className="flex justify-center">
                  <div className="h-8 w-8 border-4 border-t-transparent border-primary rounded-full animate-spin"></div>
                </div>
                <p className="mt-2 text-muted-foreground">Carregando clientes...</p>
              </TableCell>
            </TableRow>
          ) : sortedContacts.length > 0 ? (
            sortedContacts.map((contact) => (
              <TableRow 
                key={contact.id} 
                className="cursor-pointer hover:bg-muted/60"
                onClick={() => onContactClick(contact)}
              >
                <TableCell className="font-medium text-xs py-3">{contact.name}</TableCell>
                <TableCell className="text-xs py-3">{contact.email || '-'}</TableCell>
                <TableCell className="text-xs py-3 font-mono">{contact.phone || '-'}</TableCell>
                <TableCell className="text-xs py-3">{contact.petName || '-'}</TableCell>
                <TableCell className="text-xs py-3">
                  {(() => {
                    const clientTags = tagsPorCliente?.get(parseInt(contact.id)) || [];
                    if (clientTags.length === 0) return <span className="text-muted-foreground">-</span>;
                    return (
                      <div className="flex max-w-[180px] flex-wrap gap-1">
                        {clientTags.slice(0, 3).map(tag => (
                          <TagBadge key={tag.id} tag={tag} />
                        ))}
                        {clientTags.length > 3 && (
                          <span className="text-[10px] text-muted-foreground">+{clientTags.length - 3}</span>
                        )}
                      </div>
                    );
                  })()}
                </TableCell>
                <TableCell className="text-xs py-3">
                  {(() => {
                    const abertas = abertasPorCliente?.get(parseInt(contact.id))?.length || 0;
                    if (abertas === 0) return <span className="text-muted-foreground">-</span>;
                    return (
                      <span
                        className="inline-flex items-center rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-medium text-warning tabular-nums"
                        title={`${abertas} pendência(s) em aberto`}
                      >
                        {abertas} {abertas === 1 ? 'pendência' : 'pendências'}
                      </span>
                    );
                  })()}
                </TableCell>
                <TableCell className="text-xs py-3">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                    contact.status === 'Active' 
                      ? 'bg-success/10 text-success' 
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {contact.status === 'Active' ? 'Ativo' : 'Inativo'}
                  </span>
                </TableCell>
                <TableCell className="text-xs py-3">{contact.lastContact}</TableCell>
                <TableCell className="text-xs py-2 text-center" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-primary hover:bg-accent hover:text-primary"
                      onClick={() => onEditClick(contact)}
                      title="Editar cliente"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-success hover:bg-success/10 hover:text-success"
                      onClick={() => onMessageClick(contact)}
                      title="Enviar mensagem"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => onDeleteClick(contact)}
                      title="Excluir cliente"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={9} className="h-24 text-center text-xs">
                {searchTerm 
                  ? 'Nenhum cliente encontrado com os filtros e termo de busca atuais.' 
                  : 'Nenhum cliente disponível.'}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default ClientsTable;
