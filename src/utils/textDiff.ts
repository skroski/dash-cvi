export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  text: string;
  lineNumberOld?: number;
  lineNumberNew?: number;
}

export interface RuleDiffItem {
  id: string;
  titulo: string;
  categoria: string;
  type: 'added' | 'removed' | 'modified' | 'unchanged';
  oldConteudo?: string;
  newConteudo?: string;
  oldAtiva?: boolean;
  newAtiva?: boolean;
}

/**
 * Algoritmo de Diff linha a linha (LCS) simples e rápido para texto puro
 */
export function computeLineDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText ? oldText.split('\n') : [];
  const newLines = newText ? newText.split('\n') : [];

  const n = oldLines.length;
  const m = newLines.length;

  // Matriz LCS (Longest Common Subsequence)
  // Limitamos para evitar uso excessivo de memória em textos gigantescos
  if (n * m > 2_000_000) {
    // Fallback rápido se texto for descomunal
    return fallbackSimpleDiff(oldLines, newLines);
  }

  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const result: DiffLine[] = [];
  let i = n;
  let j = m;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.unshift({
        type: 'unchanged',
        text: oldLines[i - 1],
        lineNumberOld: i,
        lineNumberNew: j,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({
        type: 'added',
        text: newLines[j - 1],
        lineNumberNew: j,
      });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      result.unshift({
        type: 'removed',
        text: oldLines[i - 1],
        lineNumberOld: i,
      });
      i--;
    }
  }

  return result;
}

function fallbackSimpleDiff(oldLines: string[], newLines: string[]): DiffLine[] {
  const res: DiffLine[] = [];
  const max = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < max; i++) {
    if (i < oldLines.length && i < newLines.length) {
      if (oldLines[i] === newLines[i]) {
        res.push({ type: 'unchanged', text: oldLines[i], lineNumberOld: i + 1, lineNumberNew: i + 1 });
      } else {
        res.push({ type: 'removed', text: oldLines[i], lineNumberOld: i + 1 });
        res.push({ type: 'added', text: newLines[i], lineNumberNew: i + 1 });
      }
    } else if (i < oldLines.length) {
      res.push({ type: 'removed', text: oldLines[i], lineNumberOld: i + 1 });
    } else {
      res.push({ type: 'added', text: newLines[i], lineNumberNew: i + 1 });
    }
  }
  return res;
}

/**
 * Compara o snapshot de regras entre duas versões para mostrar um resumo legível
 */
export function computeRulesDiff(
  oldRules: Array<{ id?: string; codigo?: string; titulo: string; categoria: string; conteudo: string; ativa?: boolean }>,
  newRules: Array<{ id?: string; codigo?: string; titulo: string; categoria: string; conteudo: string; ativa?: boolean }>
): RuleDiffItem[] {
  const diffs: RuleDiffItem[] = [];
  const oldMap = new Map((oldRules || []).map((r) => [r.codigo || r.id || r.titulo, r]));
  const newMap = new Map((newRules || []).map((r) => [r.codigo || r.id || r.titulo, r]));

  // Checa regras adicionadas e modificadas
  for (const [key, newRule] of newMap.entries()) {
    const oldRule = oldMap.get(key);
    if (!oldRule) {
      diffs.push({
        id: newRule.id || key,
        titulo: newRule.titulo,
        categoria: newRule.categoria,
        type: 'added',
        newConteudo: newRule.conteudo,
        newAtiva: newRule.ativa ?? true,
      });
    } else {
      const conteudoMudou = oldRule.conteudo !== newRule.conteudo;
      const statusMudou = oldRule.ativa !== newRule.ativa;
      if (conteudoMudou || statusMudou) {
        diffs.push({
          id: newRule.id || key,
          titulo: newRule.titulo,
          categoria: newRule.categoria,
          type: 'modified',
          oldConteudo: oldRule.conteudo,
          newConteudo: newRule.conteudo,
          oldAtiva: oldRule.ativa ?? true,
          newAtiva: newRule.ativa ?? true,
        });
      }
    }
  }

  // Checa regras removidas
  for (const [key, oldRule] of oldMap.entries()) {
    if (!newMap.has(key)) {
      diffs.push({
        id: oldRule.id || key,
        titulo: oldRule.titulo,
        categoria: oldRule.categoria,
        type: 'removed',
        oldConteudo: oldRule.conteudo,
        oldAtiva: oldRule.ativa ?? true,
      });
    }
  }

  return diffs;
}
