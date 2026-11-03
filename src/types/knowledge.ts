export interface Document {
  id: number;
  name: string;
  type: string;
  size: string;
  uploadedAt: string;
  category: string;
  origem: 'upload' | 'google_drive' | string;
  driveId?: string | null;
  partes: number;
  totalCaracteres?: number;
  titulo?: string | null;
  metadata?: Record<string, any> | null;
}

export interface DocumentChunk {
  id: number;
  content: string;
  metadata: {
    categoria?: string;
    arquivo?: string;
    origem?: string;
    drive_id?: string;
    parte?: number;
    total_partes?: number;
    caracteres?: number;
    [key: string]: any;
  };
  created_at?: string;
}

export interface RagSource {
  id: number;
  titulo: string;
  categoria: string;
  origem: string;
  conteudo: string;
  similaridade: number;
}

export interface RagTestResult {
  ok: boolean;
  pergunta: string;
  resposta: string;
  fontes: RagSource[];
  tempo_total_ms: number;
  tempo_busca_ms: number;
  tempo_ia_ms: number;
}

export interface KnowledgeStats {
  total_documentos: number;
  total_chunks: number;
  total_caracteres: number;
  origens: Record<string, number>;
  categorias: Record<string, number>;
}
