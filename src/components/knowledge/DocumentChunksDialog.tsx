import React, { useEffect, useState } from 'react';
import { Layers, Loader2, Copy, Check, FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import type { DocumentChunk } from '@/types/knowledge';

interface DocumentChunksDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  documentTitle: string;
  onFetchChunks: (title: string) => Promise<DocumentChunk[]>;
}

const DocumentChunksDialog: React.FC<DocumentChunksDialogProps> = ({
  isOpen,
  onOpenChange,
  documentTitle,
  onFetchChunks,
}) => {
  const [chunks, setChunks] = useState<DocumentChunk[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen && documentTitle) {
      setIsLoading(true);
      onFetchChunks(documentTitle)
        .then((data) => setChunks(data))
        .finally(() => setIsLoading(false));
    } else {
      setChunks([]);
    }
  }, [isOpen, documentTitle, onFetchChunks]);

  const copyChunk = (id: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Trecho copiado!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10 text-violet-500">
              <Layers className="h-5 w-5" />
            </div>
            <div className="truncate">
              <DialogTitle className="truncate">Fragmentos Vetoriais (Chunks)</DialogTitle>
              <DialogDescription className="truncate">
                {documentTitle}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden py-2">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
              <p className="text-sm">Carregando fragmentos do PGVector...</p>
            </div>
          ) : chunks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <FileText className="h-8 w-8 opacity-40" />
              <p className="text-sm">Nenhum fragmento encontrado para este título.</p>
            </div>
          ) : (
            <ScrollArea className="h-[55vh] pr-4">
              <div className="space-y-3">
                <div className="text-xs text-muted-foreground px-1">
                  Total de <strong>{chunks.length}</strong> fragmentos indexados no banco de dados:
                </div>

                {chunks.map((chunk, index) => {
                  const parte = chunk.metadata?.parte || index + 1;
                  const total = chunk.metadata?.total_partes || chunks.length;
                  const chars = chunk.content.length;

                  return (
                    <div
                      key={chunk.id || index}
                      className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2 text-xs shadow-sm hover:border-primary/40 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-primary/10 text-primary font-semibold px-2 py-0.5 text-[11px]">
                            Parte {parte} de {total}
                          </span>
                          <span className="text-muted-foreground text-[11px]">
                            {chars} caracteres
                          </span>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyChunk(chunk.id, chunk.content)}
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                        >
                          {copiedId === chunk.id ? (
                            <>
                              <Check className="h-3.5 w-3.5 mr-1 text-emerald-500" />
                              Copiado
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5 mr-1" />
                              Copiar
                            </>
                          )}
                        </Button>
                      </div>

                      <div className="rounded bg-background p-2.5 border border-border/40 font-mono text-[11px] text-foreground leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                        {chunk.content}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DocumentChunksDialog;
