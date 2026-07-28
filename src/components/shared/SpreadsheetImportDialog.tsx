import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  SpreadsheetImportPreview,
  SpreadsheetImportResult,
} from '@/types/spreadsheet';
import { cn } from '@/lib/utils';

interface ImportConfiguration {
  id: number;
  name: string;
}

interface SpreadsheetImportDialogProps<T> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  configurationLabel: string;
  configurations: ImportConfiguration[];
  requiredColumns: string[];
  parseFile: (file: File) => Promise<SpreadsheetImportPreview<T>>;
  onImport: (
    configurationId: number,
    rows: T[]
  ) => Promise<SpreadsheetImportResult>;
  onDownloadTemplate: () => Promise<void>;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const SpreadsheetImportDialog = <T,>({
  open,
  onOpenChange,
  title,
  description,
  configurationLabel,
  configurations,
  requiredColumns,
  parseFile,
  onImport,
  onDownloadTemplate,
}: SpreadsheetImportDialogProps<T>) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [configurationId, setConfigurationId] = useState('');
  const [preview, setPreview] = useState<SpreadsheetImportPreview<T> | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!open) return;
    setConfigurationId((current) => {
      if (current && configurations.some((item) => String(item.id) === current)) {
        return current;
      }
      return configurations[0] ? String(configurations[0].id) : '';
    });
    setPreview(null);
    setParseError(null);
    setParsing(false);
    setImporting(false);
    setDragging(false);
  }, [configurations, open]);

  const summary = useMemo(() => {
    const items = preview?.items ?? [];
    const invalid = items.filter((item) => item.errors.length > 0).length;
    const duplicates = items.filter(
      (item) => item.errors.length === 0 && item.duplicate
    ).length;
    const valid = items.filter(
      (item) => item.data && item.errors.length === 0 && !item.duplicate
    );
    return { invalid, duplicates, valid };
  }, [preview]);

  const handleFile = async (file?: File) => {
    if (!file) return;
    setParseError(null);
    setPreview(null);

    if (file.size > MAX_FILE_SIZE) {
      setParseError('O arquivo excede o limite de 10 MB.');
      return;
    }

    setParsing(true);
    try {
      const result = await parseFile(file);
      if (result.items.length === 0) {
        throw new Error('A planilha não possui linhas de dados.');
      }
      setPreview(result);
    } catch (error) {
      console.error('Erro ao ler planilha:', error);
      setParseError(
        error instanceof Error ? error.message : 'Não foi possível ler a planilha.'
      );
    } finally {
      setParsing(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleInput = (event: ChangeEvent<HTMLInputElement>) => {
    handleFile(event.target.files?.[0]);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    handleFile(event.dataTransfer.files?.[0]);
  };

  const handleImport = async () => {
    if (!configurationId || summary.valid.length === 0 || importing) return;
    setImporting(true);
    try {
      const result = await onImport(
        Number(configurationId),
        summary.valid.map((item) => item.data as T)
      );
      toast.success('Planilha importada', {
        description: [
          `${result.imported} novo(s) registro(s)`,
          result.updated ? `${result.updated} atualizado(s)` : null,
          result.ignored ? `${result.ignored} ignorado(s)` : null,
          result.responsesImported
            ? `${result.responsesImported} resposta(s) importada(s)`
            : null,
        ]
          .filter(Boolean)
          .join(' · '),
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao importar planilha:', error);
      toast.error('Não foi possível importar os dados', {
        description:
          error instanceof Error
            ? error.message
            : 'Revise o arquivo e tente novamente.',
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {configurations.length === 0 ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <AlertTitle>Crie uma configuração antes de importar</AlertTitle>
              <AlertDescription>
                Cada linha precisa ser associada a uma regra ou campanha do Dashboard.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-1.5">
              <label htmlFor="spreadsheet-configuration" className="text-sm font-medium">
                {configurationLabel}
              </label>
              <Select value={configurationId} onValueChange={setConfigurationId}>
                <SelectTrigger
                  id="spreadsheet-configuration"
                  className="min-h-11 w-full sm:w-80"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {configurations.map((configuration) => (
                    <SelectItem
                      key={configuration.id}
                      value={String(configuration.id)}
                    >
                      {configuration.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div
            className={cn(
              'rounded-lg border-2 border-dashed p-6 text-center transition-colors',
              dragging ? 'border-primary bg-primary/5' : 'border-border',
              configurations.length === 0 && 'pointer-events-none opacity-55'
            )}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            {parsing ? (
              <div className="flex min-h-32 flex-col items-center justify-center">
                <Loader2
                  className="h-8 w-8 animate-spin text-primary"
                  aria-hidden="true"
                />
                <p className="mt-3 text-sm font-medium">Lendo a planilha...</p>
              </div>
            ) : (
              <>
                <FileSpreadsheet
                  className="mx-auto h-10 w-10 text-primary"
                  aria-hidden="true"
                />
                <p className="mt-3 text-sm font-medium">
                  Arraste um arquivo Excel ou CSV
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Formatos aceitos: .xlsx e .csv · máximo de 10 MB
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 gap-2"
                    onClick={() => inputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4" aria-hidden="true" />
                    Selecionar arquivo
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-11 gap-2"
                    onClick={() => onDownloadTemplate()}
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    Baixar modelo
                  </Button>
                </div>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={handleInput}
              className="sr-only"
            />
          </div>

          <div className="rounded-lg border bg-muted/25 p-3">
            <p className="text-xs font-medium">Colunas reconhecidas</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {requiredColumns.map((column) => (
                <Badge key={column} variant="outline" className="font-normal">
                  {column}
                </Badge>
              ))}
            </div>
          </div>

          {parseError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <AlertTitle>Arquivo não reconhecido</AlertTitle>
              <AlertDescription>{parseError}</AlertDescription>
            </Alert>
          )}

          {preview && (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <SummaryBox
                  icon={CheckCircle2}
                  label="Prontos para importar"
                  value={summary.valid.length}
                  className="text-success"
                />
                <SummaryBox
                  icon={FileSpreadsheet}
                  label="Duplicados no arquivo"
                  value={summary.duplicates}
                  className="text-warning"
                />
                <SummaryBox
                  icon={AlertCircle}
                  label="Linhas com erro"
                  value={summary.invalid}
                  className="text-destructive"
                />
              </div>

              <div className="overflow-hidden rounded-lg border">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{preview.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      Aba “{preview.sheetName}” · prévia das primeiras 10 linhas
                    </p>
                  </div>
                  <Badge variant="outline">{preview.items.length} linha(s)</Badge>
                </div>
                <div className="overflow-x-auto">
                  <Table className="min-w-[720px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Linha</TableHead>
                        {preview.columns.map((column) => (
                          <TableHead key={column}>{column}</TableHead>
                        ))}
                        <TableHead>Validação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.items.slice(0, 10).map((item) => (
                        <TableRow key={item.sourceRow}>
                          <TableCell className="tabular-nums">
                            {item.sourceRow}
                          </TableCell>
                          {item.preview.map((cell, index) => (
                            <TableCell key={`${item.sourceRow}-${index}`}>
                              {cell}
                            </TableCell>
                          ))}
                          <TableCell className="max-w-64">
                            {item.errors.length > 0 ? (
                              <span className="text-xs text-destructive">
                                {item.errors.join(' ')}
                              </span>
                            ) : item.duplicate ? (
                              <Badge
                                variant="outline"
                                className="border-warning/20 bg-warning/10 text-warning"
                              >
                                Duplicado
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="border-success/20 bg-success/10 text-success"
                              >
                                Válido
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleImport}
            disabled={
              importing ||
              parsing ||
              !configurationId ||
              summary.valid.length === 0
            }
          >
            {importing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            Importar {summary.valid.length || ''} registro(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const SummaryBox = ({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: number;
  className: string;
}) => (
  <div className="rounded-lg border bg-card p-3">
    <div className="flex items-center gap-2">
      <Icon className={cn('h-4 w-4', className)} aria-hidden="true" />
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
    <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
  </div>
);

export default SpreadsheetImportDialog;
