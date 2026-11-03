/** Detecção de loop robô x robô (URA, operadora) com padrões configuráveis. */
export function compilarPadroes(padroes: unknown): RegExp[] {
  if (!Array.isArray(padroes)) return [];
  const compilados: RegExp[] = [];
  for (const item of padroes.slice(0, 50)) {
    if (typeof item !== 'string' || !item.trim() || item.length > 200) continue;
    try {
      compilados.push(new RegExp(item, 'i'));
    } catch {
      // padrão inválido digitado no painel: ignora em vez de derrubar o worker
    }
  }
  return compilados;
}

export function pareceLoopDeRobo(
  textoRecebido: string,
  respostasRecentesDoBot: number,
  padroes: unknown,
  minimoRespostas = 3,
): boolean {
  if (respostasRecentesDoBot < minimoRespostas) return false;
  return compilarPadroes(padroes).some((re) => re.test(textoRecebido));
}
