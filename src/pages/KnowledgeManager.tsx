import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import PageContainer from '@/components/layout/PageContainer';
import KnowledgeStatsBar from '@/components/knowledge/KnowledgeStatsBar';
import SearchBar from '@/components/knowledge/SearchBar';
import DocumentGrid from '@/components/knowledge/DocumentGrid';
import AddDocumentDialog from '@/components/knowledge/AddDocumentDialog';
import ImportDriveDialog from '@/components/knowledge/ImportDriveDialog';
import RagTestPlaygroundDialog from '@/components/knowledge/RagTestPlaygroundDialog';
import DocumentChunksDialog from '@/components/knowledge/DocumentChunksDialog';
import { useDocuments } from '@/hooks/useDocuments';

const KnowledgeManager: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('todas');
  const [selectedOrigin, setSelectedOrigin] = useState('todas');

  // Modais
  const [isAddDocumentOpen, setIsAddDocumentOpen] = useState(false);
  const [isImportDriveOpen, setIsImportDriveOpen] = useState(false);
  const [isRagTestOpen, setIsRagTestOpen] = useState(false);
  const [selectedChunkTitle, setSelectedChunkTitle] = useState<string | null>(null);

  const {
    documents,
    stats,
    isLoading,
    isRefreshing,
    isUploading,
    isImportingDrive,
    isTestingRag,
    handleRefresh,
    handleDeleteDocument,
    uploadFileToWebhook,
    importGoogleDrive,
    testRag,
    fetchDocumentChunks,
    clearAllDocuments,
  } = useDocuments();

  // Categorias únicas existentes na base
  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    documents.forEach((d) => {
      if (d.category && d.category.trim()) {
        set.add(d.category.trim());
      }
    });
    return Array.from(set).sort();
  }, [documents]);

  const handleOpenChunks = (title: string) => {
    setSelectedChunkTitle(title);
  };

  return (
    <PageContainer>
      <div className="space-y-6">
        {/* Barra de Estatísticas em Tempo Real */}
        <KnowledgeStatsBar stats={stats} totalDocuments={documents.length} />

        {/* Card Principal de Documentos */}
        <Card className="border border-border/70 shadow-sm bg-card">
          <CardContent className="p-6">
            <div data-tour="knowledge-toolbar">
              <SearchBar
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                selectedCategory={selectedCategory}
                onCategoryChange={setSelectedCategory}
                selectedOrigin={selectedOrigin}
                onOriginChange={setSelectedOrigin}
                categories={uniqueCategories}
                onRefresh={handleRefresh}
                onAddDocument={() => setIsAddDocumentOpen(true)}
                onImportDrive={() => setIsImportDriveOpen(true)}
                onOpenRagTest={() => setIsRagTestOpen(true)}
                onClearAll={clearAllDocuments}
                isRefreshing={isRefreshing}
              />
            </div>

            <div data-tour="knowledge-grid">
              <DocumentGrid
                documents={documents}
                searchQuery={searchQuery}
                selectedCategory={selectedCategory}
                selectedOrigin={selectedOrigin}
                isLoading={isLoading}
                onDeleteDocument={handleDeleteDocument}
                onViewChunks={handleOpenChunks}
                onAddDocument={() => setIsAddDocumentOpen(true)}
                onImportDrive={() => setIsImportDriveOpen(true)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Modal: Enviar Arquivo Local */}
        <AddDocumentDialog
          isOpen={isAddDocumentOpen}
          onOpenChange={setIsAddDocumentOpen}
          onAddDocument={uploadFileToWebhook}
          isUploading={isUploading}
        />

        {/* Modal: Importar do Google Drive */}
        <ImportDriveDialog
          isOpen={isImportDriveOpen}
          onOpenChange={setIsImportDriveOpen}
          onImportDrive={importGoogleDrive}
          isImporting={isImportingDrive}
        />

        {/* Modal: Playground de Teste RAG */}
        <RagTestPlaygroundDialog
          isOpen={isRagTestOpen}
          onOpenChange={setIsRagTestOpen}
          onTestRag={testRag}
          isTesting={isTestingRag}
        />

        {/* Modal: Inspecionar Fragmentos Vetoriais */}
        <DocumentChunksDialog
          isOpen={!!selectedChunkTitle}
          onOpenChange={(open) => {
            if (!open) setSelectedChunkTitle(null);
          }}
          documentTitle={selectedChunkTitle || ''}
          onFetchChunks={fetchDocumentChunks}
        />
      </div>
    </PageContainer>
  );
};

export default KnowledgeManager;
