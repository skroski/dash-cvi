
import React from 'react';
import { Search, RefreshCw, Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface SearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onRefresh: () => void;
  onAddDocument: () => void;
  onClearAll: () => void;
  isRefreshing: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({
  searchQuery,
  onSearchChange,
  onRefresh,
  onAddDocument,
  onClearAll,
  isRefreshing
}) => {
  return (
    <div className="flex justify-between items-center mb-6">
      <div className="relative w-full max-w-md">
        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar documentos..."
          className="pl-8"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      
      <div className="flex items-center gap-2">
        <Button 
          variant="refresh" 
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
        
        <Button 
          variant="danger" 
          onClick={onClearAll}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Limpar Tudo
        </Button>
        
        <Button onClick={onAddDocument}>
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Documento
        </Button>
      </div>
    </div>
  );
};

export default SearchBar;
