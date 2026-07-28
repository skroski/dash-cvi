import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { getWebhookUrl } from '@/config/env';
import { supabase } from '@/integrations/supabase/client';

// Document type definition
export interface Document {
  id: number;
  name: string;
  type: string;
  size: string;
  uploadedAt: string;
  category: string;
  titulo?: string | null;
  metadata?: Record<string, any> | null;
}

export const useDocuments = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Safe way to extract values from metadata
  const getMetadataValue = (metadata: any, key: string, defaultValue: string): string => {
    if (typeof metadata === 'object' && metadata !== null && key in metadata) {
      return String(metadata[key]) || defaultValue;
    }
    return defaultValue;
  };

  // Fetch documents from Supabase
  const fetchDocuments = async () => {
    try {
      setIsLoading(true);
      // Only select titulo column
      const { data, error } = await supabase
        .from('documents')
        .select('titulo');

      if (error) {
        console.error('Error fetching documents:', error);
        toast.error("Erro ao carregar documentos", { description: error.message });
        return;
      }

      // Transform the data to match our Document interface
      const formattedDocs: Document[] = data.map((doc, index) => {
        // Use titulo from the database if available, otherwise generate a name
        const documentName = doc.titulo || `Documento ${index + 1}`;

        // Create dummy data for other required fields since we don't have metadata
        return {
          id: index + 1, // Generate dummy id
          name: documentName,
          type: 'unknown',
          size: 'Unknown',
          category: 'Sem categoria',
          uploadedAt: new Date().toISOString().split('T')[0],
          titulo: doc.titulo,
        };
      });

      // Filter out duplicates based on the titulo field
      const uniqueDocs = filterUniqueByTitle(formattedDocs);

      setDocuments(uniqueDocs);
    } catch (err) {
      console.error('Unexpected error fetching documents:', err);
      toast.error("Erro inesperado", { description: "Não foi possível carregar os documentos." });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Filter documents to keep only unique titulo entries
  const filterUniqueByTitle = (docs: Document[]): Document[] => {
    const uniqueTitles = new Set<string>();
    return docs.filter(doc => {
      const title = doc.titulo || doc.name;
      if (uniqueTitles.has(title)) {
        return false;
      }
      uniqueTitles.add(title);
      return true;
    });
  };

  // Handle refresh
  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchDocuments();
    toast.success("Atualizando documentos", { description: "Os documentos estão sendo atualizados do banco de dados." });
  };

  // Delete document - Updated to call the webhook with the title
  const handleDeleteDocument = async (id: number, title: string) => {
    try {
      // Call webhook to delete file from RAG system
      console.log('Enviando solicitação para excluir arquivo:', title);

      const response = await fetch(getWebhookUrl('excluirArquivoRag', '/excluir-arquivo-rag'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          titulo: title
        }),
      });

      if (!response.ok) {
        throw new Error(`Erro ao excluir o arquivo: ${response.statusText}`);
      }

      // Only remove from UI if webhook call was successful
      setDocuments(documents.filter(doc => doc.id !== id));

      toast.error("Documento excluído", { description: "O documento foi removido com sucesso!" });
    } catch (err) {
      console.error('Unexpected error deleting document:', err);
      toast.error("Erro inesperado", { description: "Não foi possível excluir o documento." });
    }
  };

  // New function to clear all documents
  const clearAllDocuments = async () => {
    try {
      console.log('Enviando solicitação para excluir toda a base de conhecimento');

      const response = await fetch(getWebhookUrl('excluirRag', '/excluir-rag'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error(`Erro ao limpar a base de conhecimento: ${response.statusText}`);
      }

      // Clear the documents array
      setDocuments([]);

      toast.error("Base de conhecimento limpa", { description: "Todos os documentos foram removidos com sucesso!" });
    } catch (err) {
      console.error('Unexpected error clearing knowledge base:', err);
      toast.error("Erro inesperado", { description: "Não foi possível limpar a base de conhecimento." });
    }
  };

  // Upload file to webhook
  const uploadFileToWebhook = async (file: File, category: string) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', category);

      console.log('Enviando arquivo para o webhook:', file.name, 'categoria:', category);

      const response = await fetch(getWebhookUrl('enviaRag', '/envia_rag'), {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Erro ao enviar o arquivo: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Arquivo enviado com sucesso:', result);

      // After successful upload, refresh the document list
      await fetchDocuments();

      toast.success("Documento adicionado", { description: `${file.name} foi adicionado com sucesso!` });

      return true;
    } catch (error) {
      console.error('Erro ao enviar o arquivo:', error);

      toast.error("Erro ao enviar documento", { description: "Não foi possível enviar o documento para o sistema de conhecimento." });

      return false;
    }
  };

  // Load documents on hook initialization
  useEffect(() => {
    fetchDocuments();
  }, []);

  return {
    documents,
    isLoading,
    isRefreshing,
    fetchDocuments,
    handleRefresh,
    handleDeleteDocument,
    uploadFileToWebhook,
    clearAllDocuments
  };
};
