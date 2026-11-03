import React, { useState } from 'react';
import { HardDrive, Loader2, Link2, Info, CheckCircle2 } from 'lucide-react';
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

interface ImportDriveDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onImportDrive: (fileIdOrUrl: string, category: string) => Promise<boolean>;
  isImporting: boolean;
}

const CATEGORIAS_SUGERIDAS = [
  'Procedimentos',
  'Tabela de Valores',
  'Regras Gerais',
  'Especialidades',
  'Exames',
  'Políticas da Clínica',
];

const ImportDriveDialog: React.FC<ImportDriveDialogProps> = ({
  isOpen,
  onOpenChange,
  onImportDrive,
  isImporting,
}) => {
  const [driveInput, setDriveInput] = useState('');
  const [category, setCategory] = useState('Procedimentos');

  const handleImport = async () => {
    if (!driveInput.trim()) return;
    const success = await onImportDrive(driveInput.trim(), category.trim() || 'Geral');
    if (success) {
      setDriveInput('');
      onOpenChange(false);
    }
  };

  const isFormValid = driveInput.trim().length > 10;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
              <HardDrive className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Importar do Google Drive</DialogTitle>
              <DialogDescription>
                Adicione arquivos do Google Drive (Docs, Planilhas ou PDFs) direto na base PGVector.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-3">
          <div className="space-y-2">
            <Label htmlFor="drive-link" className="text-sm font-medium">
              Link de Compartilhamento ou ID do Arquivo
            </Label>
            <div className="relative">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="drive-link"
                placeholder="https://docs.google.com/document/d/... ou ID do arquivo"
                value={driveInput}
                onChange={(e) => setDriveInput(e.target.value)}
                disabled={isImporting}
                className="pl-9 font-mono text-xs sm:text-sm"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Suporta Google Docs, Planilhas Google, PDFs e arquivos de texto compartilhados.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="drive-category" className="text-sm font-medium">
              Categoria
            </Label>
            <Input
              id="drive-category"
              placeholder="ex: Procedimentos, Valores, Especialidades..."
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={isImporting}
            />

            <div className="flex flex-wrap gap-1.5 pt-1">
              {CATEGORIAS_SUGERIDAS.map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => setCategory(sug)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    category === sug
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-border/60 hover:bg-muted text-muted-foreground'
                  }`}
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>

          <Alert className="bg-blue-500/5 border-blue-500/20 text-blue-900 dark:text-blue-100">
            <Info className="h-4 w-4 text-blue-500" />
            <AlertTitle className="text-xs font-semibold">Como funciona a leitura performática:</AlertTitle>
            <AlertDescription className="text-xs space-y-1 mt-1 text-muted-foreground">
              <p>• <strong>Google Docs</strong> são convertidos instantaneamente para texto limpo.</p>
              <p>• <strong>Planilhas</strong> são estruturadas em tabelas CSV antes do particionamento.</p>
              <p>• O documento é dividido em fragmentos semânticos e indexado com embeddings HNSW.</p>
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isImporting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleImport}
            disabled={!isFormValid || isImporting}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Lendo e Indexando...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Importar e Vetorizar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImportDriveDialog;
