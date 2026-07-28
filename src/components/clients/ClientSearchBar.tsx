
import React from 'react';
import { Search, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface ClientSearchBarProps {
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  isLoading: boolean;
}

const ClientSearchBar = ({ 
  searchTerm, 
  onSearchTermChange, 
  onRefresh, 
  isRefreshing, 
  isLoading 
}: ClientSearchBarProps) => {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Pesquisar clientes..." 
          className="pl-10 w-full sm:w-64"
          value={searchTerm}
          onChange={(e) => onSearchTermChange(e.target.value)}
        />
      </div>
      <Button 
        variant="refresh" 
        onClick={onRefresh} 
        disabled={isRefreshing || isLoading}
        className="min-w-[40px]"
      >
        <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        Atualizar
      </Button>
    </div>
  );
};

export default ClientSearchBar;
