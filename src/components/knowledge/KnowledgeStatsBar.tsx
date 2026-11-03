import React from 'react';
import { Database, Layers, HardDrive, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { KnowledgeStats } from '@/types/knowledge';

interface KnowledgeStatsBarProps {
  stats: KnowledgeStats | null;
  totalDocuments: number;
}

const KnowledgeStatsBar: React.FC<KnowledgeStatsBarProps> = ({ stats, totalDocuments }) => {
  const totalDocs = stats?.total_documentos ?? totalDocuments;
  const totalChunks = stats?.total_chunks ?? 0;
  const totalChars = stats?.total_caracteres ?? 0;
  const driveCount = stats?.origens?.google_drive ?? 0;
  const uploadCount = stats?.origens?.upload ?? Math.max(0, totalDocs - driveCount);

  const formatChars = (chars: number) => {
    if (chars >= 1_000_000) return `${(chars / 1_000_000).toFixed(1)}M caracteres`;
    if (chars >= 1_000) return `${(chars / 1_000).toFixed(1)}k caracteres`;
    return `${chars} caracteres`;
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
      {/* Total Documentos */}
      <Card className="border border-border/60 bg-card/60 backdrop-blur-sm shadow-sm hover:shadow transition-shadow">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Documentos na Base
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-foreground">{totalDocs}</span>
              <span className="text-xs text-muted-foreground">{formatChars(totalChars)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Total Chunks Vetoriais */}
      <Card className="border border-border/60 bg-card/60 backdrop-blur-sm shadow-sm hover:shadow transition-shadow">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/10 text-violet-500">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Vetores PGVector
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-foreground">{totalChunks}</span>
              <span className="text-xs text-muted-foreground">fragmentos indexados</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Origem dos Arquivos */}
      <Card className="border border-border/60 bg-card/60 backdrop-blur-sm shadow-sm hover:shadow transition-shadow">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
            <HardDrive className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Fontes Conectadas
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                Drive: {driveCount}
              </span>
              <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                Upload: {uploadCount}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status da Base */}
      <Card className="border border-border/60 bg-card/60 backdrop-blur-sm shadow-sm hover:shadow transition-shadow">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Motor Vetorial RAG
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-sm font-semibold text-foreground">HNSW Ativo</span>
              <span className="text-xs text-muted-foreground">(&lt;50ms)</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default KnowledgeStatsBar;
