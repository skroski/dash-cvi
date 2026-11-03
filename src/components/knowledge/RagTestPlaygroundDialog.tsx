import React, { useState } from 'react';
import { Sparkles, Search, Loader2, Clock, Zap, BookOpen, ChevronDown, ChevronUp, Bot, ExternalLink } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent } from '@/components/ui/card';
import type { RagTestResult } from '@/types/knowledge';

interface RagTestPlaygroundDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onTestRag: (query: string, matchCount?: number, threshold?: number) => Promise<RagTestResult | null>;
  isTesting: boolean;
}

const EXEMPLOS_PERGUNTAS = [
  'Qual o valor da consulta clínica geral?',
  'Quais os horários de atendimento da Dra. Carol (Oncologia)?',
  'Como funciona o agendamento de banho e tosa?',
  'Quais vacinas são recomendadas para filhotes?',
  'Qual o preparo para exames de ultrassom?',
];

const RagTestPlaygroundDialog: React.FC<RagTestPlaygroundDialogProps> = ({
  isOpen,
  onOpenChange,
  onTestRag,
  isTesting,
}) => {
  const [query, setQuery] = useState('');
  const [matchCount, setMatchCount] = useState(5);
  const [similarityThreshold, setSimilarityThreshold] = useState(0.25);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [result, setResult] = useState<RagTestResult | null>(null);

  const handleRunTest = async (queryText?: string) => {
    const textToRun = (queryText || query).trim();
    if (!textToRun) return;
    if (queryText) setQuery(queryText);

    const res = await onTestRag(textToRun, matchCount, similarityThreshold);
    if (res) {
      setResult(res);
    }
  };

  const formatSimilarity = (val: number) => {
    return `${Math.round(val * 100)}%`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Playground de Teste RAG & PGVector</DialogTitle>
              <DialogDescription>
                Simule perguntas de tutores, teste a recuperação vetorial e veja como a IA monta a resposta.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Campo de Busca */}
          <div className="space-y-2">
            <Label htmlFor="rag-query" className="text-sm font-medium">
              Pergunta ou Dúvida para Testar
            </Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="rag-query"
                  placeholder="ex: Qual o procedimento para consulta de retorno?"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRunTest();
                  }}
                  className="pl-9"
                  disabled={isTesting}
                />
              </div>
              <Button
                onClick={() => handleRunTest()}
                disabled={!query.trim() || isTesting}
                className="bg-primary hover:bg-primary/90"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Buscando...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Testar RAG
                  </>
                )}
              </Button>
            </div>

            {/* Perguntas sugeridas */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="text-xs text-muted-foreground mr-1 self-center">Exemplos:</span>
              {EXEMPLOS_PERGUNTAS.map((exemplo) => (
                <button
                  key={exemplo}
                  type="button"
                  onClick={() => handleRunTest(exemplo)}
                  className="text-xs px-2.5 py-1 rounded-full border border-border/60 hover:bg-muted text-muted-foreground transition-colors"
                >
                  {exemplo}
                </button>
              ))}
            </div>
          </div>

          {/* Configurações avançadas (Threshold e Match Count) */}
          <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex w-full items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <span>Parâmetros da Busca Vetorial (HNSW)</span>
              {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>

            {showAdvanced && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 pb-1">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <Label className="text-muted-foreground">Top K (Máx. fragmentos):</Label>
                    <span className="font-semibold text-foreground">{matchCount}</span>
                  </div>
                  <Slider
                    value={[matchCount]}
                    onValueChange={(val) => setMatchCount(val[0])}
                    min={1}
                    max={10}
                    step={1}
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <Label className="text-muted-foreground">Threshold Mínimo de Similaridade:</Label>
                    <span className="font-semibold text-foreground">{formatSimilarity(similarityThreshold)}</span>
                  </div>
                  <Slider
                    value={[similarityThreshold]}
                    onValueChange={(val) => setSimilarityThreshold(val[0])}
                    min={0.1}
                    max={0.8}
                    step={0.05}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Resultados */}
          {result && (
            <div className="space-y-4 pt-2">
              {/* Barra de Performance */}
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 bg-card/60 p-3 text-xs">
                <div className="flex items-center gap-1.5 font-medium text-foreground">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  <span>Tempo Total: <strong>{result.tempo_total_ms}ms</strong></span>
                </div>
                <span className="text-border">|</span>
                <span className="text-muted-foreground">
                  Busca PGVector: <strong className="text-foreground">{result.tempo_busca_ms}ms</strong>
                </span>
                <span className="text-border">|</span>
                <span className="text-muted-foreground">
                  Síntese IA: <strong className="text-foreground">{result.tempo_ia_ms}ms</strong>
                </span>
                <span className="text-border">|</span>
                <span className="text-muted-foreground">
                  Fragmentos Recuperados: <strong className="text-foreground">{result.fontes.length}</strong>
                </span>
              </div>

              {/* Resposta Montada */}
              <Card className="border-primary/20 bg-primary/5 shadow-sm">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                    <Bot className="h-4 w-4" />
                    <span>Resposta gerada pelo assistente:</span>
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                    {result.resposta}
                  </p>
                </CardContent>
              </Card>

              {/* Fragmentos Recuperados do PGVector */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5" />
                  Fragmentos Utilizados do PGVector ({result.fontes.length}):
                </h4>

                {result.fontes.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-2">
                    Nenhum documento atingiu o threshold de similaridade ({formatSimilarity(similarityThreshold)}). Tente diminuir o threshold ou adicionar mais documentos com esses termos.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {result.fontes.map((fonte, idx) => (
                      <div
                        key={fonte.id || idx}
                        className="rounded-lg border border-border/60 bg-card p-3 space-y-1.5 text-xs shadow-sm hover:border-primary/40 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 font-medium text-foreground truncate">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                              {idx + 1}
                            </span>
                            <span className="truncate">{fonte.titulo}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                              {fonte.categoria}
                            </span>
                            <span
                              className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                                fonte.similaridade >= 0.6
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                              }`}
                            >
                              {formatSimilarity(fonte.similaridade)}
                            </span>
                          </div>
                        </div>

                        <p className="text-muted-foreground line-clamp-3 bg-muted/30 p-2 rounded border border-border/30 font-mono text-[11px]">
                          {fonte.conteudo}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RagTestPlaygroundDialog;
