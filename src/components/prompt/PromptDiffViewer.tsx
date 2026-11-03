import React, { useMemo, useState } from 'react';
import { Check, Copy, GitCompare, RotateCcw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { computeLineDiff, computeRulesDiff } from '@/utils/textDiff';
import type { PromptVersao } from '@/types/promptRegras';

interface PromptDiffViewerProps {
  versaoBase: PromptVersao;
  versaoComparada?: PromptVersao | null;
  onRollback?: (versao: PromptVersao) => void;
  isRollbackPending?: boolean;
}

export const PromptDiffViewer: React.FC<PromptDiffViewerProps> = ({
  versaoBase,
  versaoComparada,
  onRollback,
  isRollbackPending = false,
}) => {
  const [viewMode, setViewMode] = useState<'rules' | 'text'>('rules');
  const [copied, setCopied] = useState(false);

  const oldText = versaoComparada?.conteudo || '';
  const newText = versaoBase.conteudo || '';

  const lineDiffs = useMemo(() => computeLineDiff(oldText, newText), [oldText, newText]);

  const rulesDiffs = useMemo(() => {
    return computeRulesDiff(
      (versaoComparada?.snapshot_regras || []) as unknown as Array<{ id?: string; codigo?: string; titulo: string; categoria: string; conteudo: string; ativa?: boolean }>,
      (versaoBase.snapshot_regras || []) as unknown as Array<{ id?: string; codigo?: string; titulo: string; categoria: string; conteudo: string; ativa?: boolean }>
    );
  }, [versaoBase.snapshot_regras, versaoComparada?.snapshot_regras]);

  const stats = useMemo(() => {
    const added = lineDiffs.filter((l) => l.type === 'added').length;
    const removed = lineDiffs.filter((l) => l.type === 'removed').length;
    return { added, removed };
  }, [lineDiffs]);

  const handleCopy = () => {
    navigator.clipboard.writeText(versaoBase.conteudo);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
      {/* Header do Diff */}
      <div className="p-4 border-b bg-muted/30 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <GitCompare className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">
              Comparando v{versaoBase.versao} {versaoComparada ? `com v${versaoComparada.versao}` : '(Versão inicial)'}
            </span>
            <Badge variant="outline" className="text-xs font-mono">
              v{versaoBase.versao}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {versaoBase.descricao || 'Sem descrição cadastrada'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-muted rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setViewMode('rules')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                viewMode === 'rules' ? 'bg-background shadow-xs font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Resumo por Regras ({rulesDiffs.length})
            </button>
            <button
              onClick={() => setViewMode('text')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                viewMode === 'text' ? 'bg-background shadow-xs font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Diff de Texto Completo
            </button>
          </div>

          <Button variant="outline" size="sm" onClick={handleCopy} className="h-8 text-xs gap-1">
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copiado' : 'Copiar'}
          </Button>

          {onRollback && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onRollback(versaoBase)}
              disabled={isRollbackPending}
              className="h-8 text-xs gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restaurar esta versão
            </Button>
          )}
        </div>
      </div>

      {/* Estatísticas resumidas */}
      <div className="px-4 py-2 border-b bg-muted/10 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
            +{stats.added} adições
          </span>
          <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium">
            -{stats.removed} remoções
          </span>
          <span>·</span>
          <span>{new Date(versaoBase.criado_em).toLocaleString('pt-BR')}</span>
          {versaoBase.autor_nome && <span>por {versaoBase.autor_nome}</span>}
        </div>
        <span className="text-[11px] font-mono">
          {versaoBase.conteudo.length.toLocaleString('pt-BR')} caracteres
        </span>
      </div>

      {/* Corpo do Diff */}
      <div className="flex-1 min-h-[380px] p-4">
        {viewMode === 'rules' ? (
          <ScrollArea className="h-[480px]">
            {rulesDiffs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-center">
                <Sparkles className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm font-medium">Nenhuma diferença de regras em relação à versão anterior.</p>
                <p className="text-xs text-muted-foreground mt-1">O conteúdo textual e as regras ativas são idênticos.</p>
              </div>
            ) : (
              <div className="space-y-3 pr-3">
                {rulesDiffs.map((diff) => {
                  const isAdded = diff.type === 'added';
                  const isRemoved = diff.type === 'removed';
                  const isModified = diff.type === 'modified';

                  return (
                    <div
                      key={diff.id}
                      className={`p-3.5 rounded-lg border text-sm transition-all ${
                        isAdded
                          ? 'border-emerald-500/30 bg-emerald-500/5'
                          : isRemoved
                          ? 'border-rose-500/30 bg-rose-500/5'
                          : 'border-amber-500/30 bg-amber-500/5'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={isAdded ? 'default' : isRemoved ? 'destructive' : 'secondary'}
                            className={`text-[11px] font-medium uppercase tracking-wider ${
                              isAdded ? 'bg-emerald-600' : isModified ? 'bg-amber-600 text-white' : ''
                            }`}
                          >
                            {isAdded ? '+ Adicionada' : isRemoved ? '- Removida' : '✎ Modificada'}
                          </Badge>
                          <span className="font-semibold text-foreground">{diff.titulo}</span>
                        </div>
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {diff.categoria}
                        </Badge>
                      </div>

                      {diff.oldAtiva !== undefined && diff.newAtiva !== undefined && diff.oldAtiva !== diff.newAtiva && (
                        <div className="mb-2 text-xs">
                          <span className="text-muted-foreground">Status da regra: </span>
                          <span className={diff.oldAtiva ? 'text-emerald-600' : 'text-muted-foreground'}>
                            {diff.oldAtiva ? 'Ativa' : 'Desativada'}
                          </span>
                          <span className="mx-1.5">→</span>
                          <span className={`font-semibold ${diff.newAtiva ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {diff.newAtiva ? 'Ativa' : 'Desativada'}
                          </span>
                        </div>
                      )}

                      {diff.newConteudo && (
                        <div className="mt-2 text-xs font-mono bg-background/80 p-2.5 rounded border border-border/60 whitespace-pre-wrap leading-relaxed">
                          {diff.newConteudo}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        ) : (
          <ScrollArea className="h-[480px]">
            <div className="font-mono text-xs leading-5 bg-background rounded-lg border divide-y divide-border/40 overflow-hidden">
              {lineDiffs.map((line, idx) => {
                const isAdded = line.type === 'added';
                const isRemoved = line.type === 'removed';

                return (
                  <div
                    key={idx}
                    className={`flex items-start px-3 py-1 font-mono transition-colors ${
                      isAdded
                        ? 'bg-emerald-500/15 text-emerald-900 dark:text-emerald-200'
                        : isRemoved
                        ? 'bg-rose-500/15 text-rose-900 dark:text-rose-200 line-through decoration-rose-500/50'
                        : 'text-foreground hover:bg-muted/40'
                    }`}
                  >
                    <span className="w-8 select-none text-[10px] text-muted-foreground/60 text-right mr-3 shrink-0">
                      {line.lineNumberNew || line.lineNumberOld || ''}
                    </span>
                    <span className="w-4 select-none font-bold shrink-0 text-center mr-1">
                      {isAdded ? '+' : isRemoved ? '-' : ' '}
                    </span>
                    <span className="whitespace-pre-wrap break-all flex-1">{line.text || ' '}</span>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
};
