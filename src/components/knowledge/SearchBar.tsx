import React, { useState } from 'react';
import { Search, RefreshCw, Plus, Trash2, HardDrive, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface SearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  selectedOrigin: string;
  onOriginChange: (origin: string) => void;
  categories: string[];
  onRefresh: () => void;
  onAddDocument: () => void;
  onImportDrive: () => void;
  onOpenRagTest: () => void;
  onClearAll: () => void;
  isRefreshing: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  selectedOrigin,
  onOriginChange,
  categories,
  onRefresh,
  onAddDocument,
  onImportDrive,
  onOpenRagTest,
  onClearAll,
  isRefreshing,
}) => {
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);

  return (
    <div className="space-y-4 mb-6">
      {/* Barra principal de busca e ações */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Campo de pesquisa */}
        <div className="relative flex-1 min-w-[260px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título ou categoria..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        {/* Filtros de Categoria e Origem */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
          <Select value={selectedCategory} onValueChange={onCategoryChange}>
            <SelectTrigger className="w-[160px] h-9 text-xs">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas Categorias</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedOrigin} onValueChange={onOriginChange}>
            <SelectTrigger className="w-[150px] h-9 text-xs">
              <SelectValue placeholder="Origem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas Origens</SelectItem>
              <SelectItem value="upload">Upload Local</SelectItem>
              <SelectItem value="google_drive">Google Drive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Botões de Ação */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenRagTest}
            className="border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30"
          >
            <Sparkles className="h-4 w-4 mr-1.5 text-amber-500" />
            Testar RAG
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onImportDrive}
            className="border-blue-500/40 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30"
          >
            <HardDrive className="h-4 w-4 mr-1.5 text-blue-500" />
            Google Drive
          </Button>

          <Button size="sm" onClick={onAddDocument}>
            <Plus className="h-4 w-4 mr-1.5" />
            Upload Arquivo
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="h-9 px-2.5 text-muted-foreground hover:text-foreground"
            title="Atualizar base de dados"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-primary' : ''}`} />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsConfirmClearOpen(true)}
            className="h-9 px-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
            title="Limpar toda a base"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Confirmação para Limpar Toda a Base */}
      <Dialog open={isConfirmClearOpen} onOpenChange={setIsConfirmClearOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">Limpar Toda a Base de Conhecimento?</DialogTitle>
            <DialogDescription>
              Esta ação removerá todos os documentos e todos os fragmentos vetoriais indexados no PGVector. O assistente virtual perderá o acesso a esses documentos até que sejam reenviados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsConfirmClearOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onClearAll();
                setIsConfirmClearOpen(false);
              }}
            >
              Sim, Limpar Tudo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SearchBar;
