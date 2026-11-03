import React, { useState } from 'react';
import { FileText, Trash2, HardDrive, Layers, Eye, Calendar, Tag } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Document } from '@/types/knowledge';

interface DocumentCardProps {
  document: Document;
  onDelete: (id: number, title: string, driveId?: string | null) => void;
  onViewChunks: (title: string) => void;
}

const DocumentCard: React.FC<DocumentCardProps> = ({ document, onDelete, onViewChunks }) => {
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const isGoogleDrive = document.origem === 'google_drive' || !!document.driveId;

  return (
    <>
      <Card className="group relative flex flex-col justify-between border border-border/70 bg-card hover:border-primary/50 hover:shadow-md transition-all duration-200">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  isGoogleDrive
                    ? 'bg-blue-500/10 text-blue-500'
                    : 'bg-amber-500/10 text-amber-500'
                }`}
              >
                {isGoogleDrive ? (
                  <HardDrive className="h-5 w-5" />
                ) : (
                  <FileText className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0">
                <CardTitle className="text-sm font-semibold truncate leading-tight" title={document.name}>
                  {document.name}
                </CardTitle>
                <div className="flex items-center gap-1.5 mt-1">
                  <span
                    className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                      isGoogleDrive
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                        : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                    }`}
                  >
                    {isGoogleDrive ? 'Google Drive' : 'Upload Local'}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground truncate max-w-[120px]">
                    <Tag className="h-2.5 w-2.5" />
                    {document.category}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pb-3 text-xs text-muted-foreground space-y-1.5">
          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border/40">
            <div className="flex items-center gap-1 font-medium text-foreground">
              <Layers className="h-3.5 w-3.5 text-primary" />
              <span>{document.partes} {document.partes === 1 ? 'fragmento' : 'fragmentos'}</span>
            </div>
            <span>{document.size}</span>
          </div>

          <div className="flex items-center gap-1 text-[11px]">
            <Calendar className="h-3 w-3" />
            <span>Indexado em: {document.uploadedAt}</span>
          </div>
        </CardContent>

        <CardFooter className="pt-2 pb-3 px-4 flex items-center justify-between border-t border-border/40 bg-muted/10">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onViewChunks(document.titulo || document.name)}
            className="h-8 px-2.5 text-xs text-primary hover:text-primary hover:bg-primary/10"
          >
            <Eye className="h-3.5 w-3.5 mr-1.5" />
            Ver Chunks
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsConfirmDeleteOpen(true)}
            className="h-8 px-2.5 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Excluir
          </Button>
        </CardFooter>
      </Card>

      {/* Confirmação de Exclusão */}
      <Dialog open={isConfirmDeleteOpen} onOpenChange={setIsConfirmDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir Documento da Base RAG</DialogTitle>
            <DialogDescription>
              Esta ação removerá todos os fragmentos e vetores associados a &ldquo;{document.name}&rdquo; do PGVector.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsConfirmDeleteOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onDelete(document.id, document.titulo || document.name, document.driveId);
                setIsConfirmDeleteOpen(false);
              }}
            >
              Confirmar Exclusão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DocumentCard;
