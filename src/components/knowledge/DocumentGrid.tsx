import React from 'react';
import { Database } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import DocumentCard from './DocumentCard';

interface Document {
  id: number;
  name: string;
  type: string;
  size: string;
  uploadedAt: string;
  category: string;
  titulo?: string | null;
  metadata?: Record<string, any> | null;
}

interface DocumentGridProps {
  documents: Document[];
  searchQuery: string;
  isLoading?: boolean;
  onDeleteDocument: (id: number, title: string) => void;
}

const DocumentGrid: React.FC<DocumentGridProps> = ({
  documents,
  searchQuery,
  isLoading = false,
  onDeleteDocument
}) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Carregando documentos">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-lg border p-4">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  // Filter documents based on search query, focusing on the titulo field
  const filteredDocuments = documents.filter(doc => {
    const title = doc.titulo || doc.name;
    const category = doc.category;

    return title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      category.toLowerCase().includes(searchQuery.toLowerCase());
  });

  if (filteredDocuments.length === 0) {
    return (
      <div className="col-span-full flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Database className="mb-4 h-16 w-16 opacity-30" aria-hidden="true" />
        <h3 className="mb-1 text-lg font-medium">Nenhum documento encontrado</h3>
        <p className="text-sm">
          {searchQuery ?
            "Nenhum documento corresponde à sua pesquisa." :
            "Comece adicionando documentos à sua base de conhecimento."}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {filteredDocuments.map((doc) => (
        <DocumentCard
          key={doc.id}
          document={doc}
          onDelete={onDeleteDocument}
        />
      ))}
    </div>
  );
};

export default DocumentGrid;
