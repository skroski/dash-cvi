import React from 'react';
import { Database, Plus, HardDrive } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import DocumentCard from './DocumentCard';
import type { Document } from '@/types/knowledge';

interface DocumentGridProps {
  documents: Document[];
  searchQuery: string;
  selectedCategory: string;
  selectedOrigin: string;
  isLoading?: boolean;
  onDeleteDocument: (id: number, title: string, driveId?: string | null) => void;
  onViewChunks: (title: string) => void;
  onAddDocument: () => void;
  onImportDrive: () => void;
}

const DocumentGrid: React.FC<DocumentGridProps> = ({
  documents,
  searchQuery,
  selectedCategory,
  selectedOrigin,
  isLoading = false,
  onDeleteDocument,
  onViewChunks,
  onAddDocument,
  onImportDrive,
}) => {
  if (isLoading) {
    return (
      <div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        aria-busy="true"
        aria-label="Carregando documentos"
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-xl border border-border/60 p-4 bg-card/60">
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
            <Skeleton className="h-4 w-full" />
            <div className="flex justify-between pt-2">
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-7 w-16" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Filtragem combinada por busca textual, categoria e origem
  const filteredDocuments = documents.filter((doc) => {
    const title = (doc.titulo || doc.name || '').toLowerCase();
    const category = (doc.category || '').toLowerCase();
    const query = searchQuery.toLowerCase().trim();

    const matchesQuery = !query || title.includes(query) || category.includes(query);
    const matchesCategory =
      selectedCategory === 'todas' || doc.category.toLowerCase() === selectedCategory.toLowerCase();
    const matchesOrigin =
      selectedOrigin === 'todas' ||
      (selectedOrigin === 'google_drive' && (doc.origem === 'google_drive' || !!doc.driveId)) ||
      (selectedOrigin === 'upload' && doc.origem !== 'google_drive');

    return matchesQuery && matchesCategory && matchesOrigin;
  });

  if (filteredDocuments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-xl border border-dashed border-border/70 bg-muted/10">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50 text-muted-foreground mb-4">
          <Database className="h-7 w-7 opacity-50" aria-hidden="true" />
        </div>
        <h3 className="mb-1 text-base font-semibold text-foreground">
          {searchQuery || selectedCategory !== 'todas' || selectedOrigin !== 'todas'
            ? 'Nenhum documento corresponde aos filtros'
            : 'Sua base de conhecimento está vazia'}
        </h3>
        <p className="text-xs text-muted-foreground max-w-sm mb-6">
          {searchQuery || selectedCategory !== 'todas' || selectedOrigin !== 'todas'
            ? 'Tente ajustar os termos da pesquisa ou limpar os filtros de categoria e origem.'
            : 'Adicione procedimentos, tabelas de valores ou políticas da empresa para o assistente virtual responder com precisão.'}
        </p>

        {!(searchQuery || selectedCategory !== 'todas' || selectedOrigin !== 'todas') && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button size="sm" onClick={onAddDocument}>
              <Plus className="h-4 w-4 mr-1.5" />
              Enviar Primeiro Arquivo
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onImportDrive}
              className="border-blue-500/40 text-blue-600 dark:text-blue-400 hover:bg-blue-50"
            >
              <HardDrive className="h-4 w-4 mr-1.5 text-blue-500" />
              Importar do Google Drive
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {filteredDocuments.map((doc) => (
        <DocumentCard
          key={`${doc.id}-${doc.name}`}
          document={doc}
          onDelete={onDeleteDocument}
          onViewChunks={onViewChunks}
        />
      ))}
    </div>
  );
};

export default DocumentGrid;
