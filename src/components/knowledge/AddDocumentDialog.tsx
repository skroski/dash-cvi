import React, { useState } from 'react';
import { FileUp, Upload, Loader2, FileText, CheckCircle2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface AddDocumentDialogProps {
  onAddDocument: (file: File, category: string) => Promise<boolean>;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  isUploading?: boolean;
}

const CATEGORIAS_PADRAO = [
  'Procedimentos',
  'Tabela de Valores',
  'Políticas da Clínica',
  'Especialidades',
  'Vacinas',
  'Dúvidas Frequentes',
];

const AddDocumentDialog: React.FC<AddDocumentDialogProps> = ({
  onAddDocument,
  isOpen,
  onOpenChange,
  isUploading = false,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileCategory, setFileCategory] = useState('Procedimentos');
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleUpload = async () => {
    if (selectedFile && fileCategory.trim()) {
      const ok = await onAddDocument(selectedFile, fileCategory.trim());
      if (ok) {
        setSelectedFile(null);
        setFileCategory('Procedimentos');
        onOpenChange(false);
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Adicionar Novo Documento
          </DialogTitle>
          <DialogDescription>
            Envie arquivos do seu computador para divisão em blocos semânticos e indexação no PGVector.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-3">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
              isDragOver
                ? 'border-primary bg-primary/5 scale-[1.01]'
                : 'border-border/80 hover:border-primary/50 bg-muted/20'
            }`}
          >
            <input
              type="file"
              id="file-upload"
              className="hidden"
              onChange={handleFileChange}
              accept=".pdf,.doc,.docx,.txt,.csv,.xlsx,.xls,.md,.json"
              disabled={isUploading}
            />
            <label
              htmlFor="file-upload"
              className="flex flex-col items-center justify-center cursor-pointer"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
                <FileUp className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">
                Clique para selecionar ou arraste o arquivo aqui
              </p>
              <p className="text-xs text-muted-foreground mb-2">
                PDF, DOCX, TXT, CSV, XLSX, Markdown ou JSON (até 25 MB)
              </p>
              <span className="inline-flex items-center rounded-md bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground">
                Particionamento semântico automático
              </span>
            </label>
          </div>

          {selectedFile && (
            <Alert className="bg-primary/5 border-primary/20">
              <FileText className="h-4 w-4 text-primary" />
              <AlertTitle className="text-xs font-semibold text-foreground">Arquivo selecionado</AlertTitle>
              <AlertDescription className="text-xs text-muted-foreground">
                {selectedFile.name} — {(selectedFile.size / 1024).toFixed(1)} KB
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="category" className="text-sm font-medium">
              Categoria do Documento
            </Label>
            <Input
              id="category"
              placeholder="ex: Procedimentos, Valores, Especialidades..."
              value={fileCategory}
              onChange={(e) => setFileCategory(e.target.value)}
              disabled={isUploading}
            />

            <div className="flex flex-wrap gap-1.5 pt-1">
              {CATEGORIAS_PADRAO.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFileCategory(cat)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    fileCategory === cat
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-border/60 hover:bg-muted text-muted-foreground'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isUploading}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleUpload}
            disabled={!selectedFile || !fileCategory.trim() || isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Indexando Vetores...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Vetorizar e Salvar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddDocumentDialog;
