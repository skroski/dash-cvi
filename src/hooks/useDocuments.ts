import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Document, DocumentChunk, RagTestResult, KnowledgeStats } from '@/types/knowledge';

export type { Document } from '@/types/knowledge';

function calcularStatsLocais(docs: Document[]): KnowledgeStats {
  const origens: Record<string, number> = {};
  const categorias: Record<string, number> = {};
  let totalChunks = 0;
  let totalCaracteres = 0;

  for (const doc of docs) {
    totalChunks += doc.partes || 1;
    totalCaracteres += doc.totalCaracteres || 0;
    const o = doc.origem || 'upload';
    origens[o] = (origens[o] || 0) + 1;
    const c = doc.category || 'Geral';
    categorias[c] = (categorias[c] || 0) + 1;
  }

  return {
    total_documentos: docs.length,
    total_chunks: totalChunks,
    total_caracteres: totalCaracteres,
    origens,
    categorias,
  };
}

export const useDocuments = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [stats, setStats] = useState<KnowledgeStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isImportingDrive, setIsImportingDrive] = useState(false);
  const [isTestingRag, setIsTestingRag] = useState(false);

  // Calcula e atualiza estatísticas da base RAG a partir dos documentos carregados
  const fetchStats = useCallback(async (currentDocs?: Document[]) => {
    const targetDocs = currentDocs ?? documents;
    setStats(calcularStatsLocais(targetDocs));
  }, [documents]);

  // Busca listagem consolidada de documentos indexados no PGVector
  const fetchDocuments = useCallback(async (silencioso = false) => {
    try {
      if (!silencioso) setIsLoading(true);
      const { data, error } = await supabase.functions.invoke('conhecimento', {
        body: { action: 'listar' },
      });

      if (error || data?.error) {
        const detail = error?.message || String(data?.error || 'Erro desconhecido');
        console.error('Error fetching documents:', detail);
        if (!silencioso) {
          toast.error("Erro ao carregar documentos", { description: detail });
        }
        return;
      }

      const formattedDocs: Document[] = (data?.documents || []).map((doc: {
        id: number;
        titulo: string;
        categoria?: string;
        origem?: string;
        drive_id?: string | null;
        partes?: number;
        total_caracteres?: number;
        criado_em?: string;
        atualizado_em?: string;
      }) => {
        const partesCount = Number(doc.partes || 1);
        const dataUpload = doc.atualizado_em || doc.criado_em;
        const dataFormatada = dataUpload ? new Date(dataUpload).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR');

        return {
          id: doc.id,
          name: doc.titulo,
          titulo: doc.titulo,
          type: doc.origem === 'google_drive' ? 'Google Drive' : 'Arquivo Local',
          size: doc.total_caracteres ? `${Math.round(doc.total_caracteres / 1024 * 10) / 10} KB` : `${partesCount} chunks`,
          category: doc.categoria || 'Geral',
          origem: doc.origem || 'upload',
          driveId: doc.drive_id,
          partes: partesCount,
          totalCaracteres: doc.total_caracteres,
          uploadedAt: dataFormatada,
        };
      });

      setDocuments(formattedDocs);
      await fetchStats(formattedDocs);
    } catch (err) {
      console.error('Unexpected error fetching documents:', err);
      if (!silencioso) {
        toast.error("Erro inesperado", { description: "Não foi possível carregar os documentos." });
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [fetchStats]);

  // Recarrega lista e métricas
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchDocuments();
    toast.success("Atualizando base de conhecimento", {
      description: "Consultando índices e documentos do PGVector...",
    });
  }, [fetchDocuments]);

  // Exclui todas as partes de um documento (por título ou driveId)
  const handleDeleteDocument = useCallback(async (id: number, title: string, driveId?: string | null) => {
    try {
      const { data, error } = await supabase.functions.invoke('conhecimento', {
        body: { action: 'excluir', titulo: title, drive_id: driveId },
      });
      if (error || data?.error) throw new Error(error?.message || String(data?.error));

      setDocuments((current) => {
        const next = current.filter((doc) => doc.id !== id && doc.name !== title);
        fetchStats(next);
        return next;
      });
      toast.success("Documento excluído", { description: `"${title}" foi removido da base vetorial.` });
    } catch (err) {
      console.error('Unexpected error deleting document:', err);
      toast.error("Erro ao excluir documento", { description: "Não foi possível remover o documento do banco." });
    }
  }, [fetchStats]);

  // Limpa completamente a base RAG
  const clearAllDocuments = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('conhecimento', {
        body: { action: 'limpar' },
      });
      if (error || data?.error) throw new Error(error?.message || String(data?.error));

      setDocuments([]);
      setStats(null);
      toast.success("Base de conhecimento limpa", { description: "Todos os vetores foram removidos." });
    } catch (err) {
      console.error('Unexpected error clearing knowledge base:', err);
      toast.error("Erro ao limpar base", { description: "Não foi possível limpar os documentos." });
    }
  }, []);

  // Upload direto de arquivo pelo navegador
  const uploadFileToWebhook = useCallback(async (file: File, category: string): Promise<boolean> => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('action', 'enviar');
      formData.append('file', file);
      formData.append('category', category);

      const { data, error } = await supabase.functions.invoke('conhecimento', {
        body: formData,
      });

      if (error || data?.error) {
        throw new Error(error?.message || String(data?.error || 'Erro no envio'));
      }

      await fetchDocuments(true);
      toast.success("Documento indexado com sucesso!", {
        description: `"${file.name}" foi dividido em ${data?.partes || 1} fragmentos com PGVector.`,
      });
      return true;
    } catch (error: any) {
      console.error('Erro ao enviar o arquivo:', error);
      toast.error("Erro ao processar arquivo", {
        description: error?.message || "Não foi possível extrair e indexar o arquivo.",
      });
      return false;
    } finally {
      setIsUploading(false);
    }
  }, [fetchDocuments]);

  // Importação e indexação de arquivo do Google Drive
  const importGoogleDrive = useCallback(async (
    urlOuId: string,
    category: string,
    tokenUsuario?: string
  ): Promise<boolean> => {
    setIsImportingDrive(true);
    try {
      // Tenta usar o token salvo da Google Agenda/OAuth se não fornecido
      const storedToken = tokenUsuario || localStorage.getItem('cvi_google_access_token') || undefined;

      const { data, error } = await supabase.functions.invoke('conhecimento', {
        body: {
          action: 'importar_drive',
          file_id_or_url: urlOuId,
          categoria: category,
          google_token: storedToken,
        },
      });

      if (error || data?.error) {
        throw new Error(error?.message || String(data?.error || 'Erro ao importar do Google Drive'));
      }

      await fetchDocuments(true);
      toast.success("Arquivo do Google Drive indexado!", {
        description: `"${data?.titulo}" foi lido e dividido em ${data?.partes || 1} vetores no PGVector.`,
      });
      return true;
    } catch (error: any) {
      console.error('Erro ao importar do Google Drive:', error);
      toast.error("Erro ao importar do Google Drive", {
        description: error?.message || "Verifique o link do arquivo ou as permissões de compartilhamento.",
      });
      return false;
    } finally {
      setIsImportingDrive(false);
    }
  }, [fetchDocuments]);

  // Testar busca semântica e respostas RAG
  const testRag = useCallback(async (
    pergunta: string,
    matchCount = 5,
    similarityThreshold = 0.25
  ): Promise<RagTestResult | null> => {
    setIsTestingRag(true);
    try {
      const { data, error } = await supabase.functions.invoke('conhecimento', {
        body: {
          action: 'testar_rag',
          pergunta,
          match_count: matchCount,
          similarity_threshold: similarityThreshold,
        },
      });

      if (error || data?.error) {
        throw new Error(error?.message || String(data?.error || 'Erro ao testar RAG'));
      }

      return data as RagTestResult;
    } catch (error: any) {
      console.error('Erro ao testar busca RAG:', error);
      toast.error("Erro na consulta de teste", {
        description: error?.message || "Não foi possível testar a busca vetorial.",
      });
      return null;
    } finally {
      setIsTestingRag(false);
    }
  }, []);

  // Busca os chunks detalhados de um documento para visualização
  const fetchDocumentChunks = useCallback(async (titulo: string): Promise<DocumentChunk[]> => {
    try {
      const { data, error } = await supabase.functions.invoke('conhecimento', {
        body: { action: 'listar_chunks', titulo },
      });

      if (error || data?.error) {
        throw new Error(error?.message || String(data?.error));
      }

      return (data?.chunks || []) as DocumentChunk[];
    } catch (err: any) {
      console.error('Erro ao listar chunks:', err);
      toast.error("Erro ao carregar fragmentos", {
        description: err?.message || "Não foi possível obter os chunks deste documento.",
      });
      return [];
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  return {
    documents,
    stats,
    isLoading,
    isRefreshing,
    isUploading,
    isImportingDrive,
    isTestingRag,
    fetchDocuments,
    fetchStats,
    handleRefresh,
    handleDeleteDocument,
    uploadFileToWebhook,
    importGoogleDrive,
    testRag,
    fetchDocumentChunks,
    clearAllDocuments,
  };
};
