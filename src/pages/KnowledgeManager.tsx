import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import PageContainer from '@/components/layout/PageContainer';
import SearchBar from '@/components/knowledge/SearchBar';
import DocumentGrid from '@/components/knowledge/DocumentGrid';
import AddDocumentDialog from '@/components/knowledge/AddDocumentDialog';
import { useDocuments } from '@/hooks/useDocuments';

const KnowledgeManager = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddDocumentOpen, setIsAddDocumentOpen] = useState(false);

  const {
    documents,
    isLoading,
    isRefreshing,
    handleRefresh,
    handleDeleteDocument,
    uploadFileToWebhook,
    clearAllDocuments
  } = useDocuments();

  const handleAddDocument = async (file: File, category: string) => {
    await uploadFileToWebhook(file, category);
  };

  return (
    <PageContainer>
      <Card className="shadow-sm">
        <CardContent className="p-6">
          <SearchBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onRefresh={handleRefresh}
            onAddDocument={() => setIsAddDocumentOpen(true)}
            onClearAll={clearAllDocuments}
            isRefreshing={isRefreshing}
          />

          <DocumentGrid
            documents={documents}
            searchQuery={searchQuery}
            isLoading={isLoading}
            onDeleteDocument={handleDeleteDocument}
          />

          <AddDocumentDialog
            isOpen={isAddDocumentOpen}
            onOpenChange={setIsAddDocumentOpen}
            onAddDocument={handleAddDocument}
          />
        </CardContent>
      </Card>
    </PageContainer>
  );
};

export default KnowledgeManager;
