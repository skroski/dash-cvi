/**
 * Utilidades de resolução de alvo do tour.
 *
 * O painel tem rotas lazy, painéis que só existem no desktop e telas que caem
 * em `EmptyState` quando a migração correspondente não foi aplicada. Por isso
 * nenhum passo pode assumir que o alvo existe: ou esperamos ele aparecer, ou
 * o passo é pulado.
 */

/** Primeiro elemento do seletor que está de fato renderizado e visível. */
export function findVisible(selector: string): HTMLElement | null {
  let nodes: NodeListOf<HTMLElement>;
  try {
    nodes = document.querySelectorAll<HTMLElement>(selector);
  } catch {
    // Seletor inválido não deve derrubar o tour.
    return null;
  }
  for (const node of Array.from(nodes)) {
    if (node.getClientRects().length > 0) return node;
  }
  return null;
}

/**
 * Espera o alvo aparecer. Resolve com `null` no timeout — quem chama decide se
 * pula o passo ou mostra centralizado.
 */
export function waitForElement(
  selector: string,
  timeoutMs = 3000
): Promise<HTMLElement | null> {
  const imediato = findVisible(selector);
  if (imediato) return Promise.resolve(imediato);

  return new Promise((resolve) => {
    let finalizado = false;

    const finalizar = (el: HTMLElement | null) => {
      if (finalizado) return;
      finalizado = true;
      observer.disconnect();
      clearInterval(intervalo);
      clearTimeout(prazo);
      resolve(el);
    };

    const tentar = () => {
      const el = findVisible(selector);
      if (el) finalizar(el);
    };

    const observer = new MutationObserver(tentar);
    observer.observe(document.body, { childList: true, subtree: true });

    // Rede de segurança: o elemento pode existir no DOM e só ganhar dimensões
    // depois (animação de painel, Suspense resolvido, sidebar abrindo).
    const intervalo = window.setInterval(tentar, 120);
    const prazo = window.setTimeout(() => finalizar(null), timeoutMs);
  });
}

/** Pausa curta usada para dar um frame ao React depois de navegar. */
export function proximoQuadro(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}
