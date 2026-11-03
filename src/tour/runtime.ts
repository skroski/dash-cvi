/**
 * Runtime do tour — o único módulo que importa o Shepherd.
 *
 * Está isolado de propósito: `TourProvider` faz `await import('./runtime')`
 * apenas quando alguém clica em iniciar um tour, então nem a biblioteca nem o
 * CSS entram no bundle inicial do painel.
 */
import Shepherd from 'shepherd.js';
import type { Step, StepOptions, Tour } from 'shepherd.js';
import 'shepherd.js/dist/css/shepherd.css';
import './shepherd-theme.css';

import type { Papel } from '@/types/perfil';
import type { TourDef, TourStepDef } from './types';
import { findVisible, proximoQuadro, waitForElement } from './waitForElement';

export interface RunTourContext {
  papel: Papel;
  isMobile: () => boolean;
  /** Rota atual, lida na hora (não capturada). */
  rotaAtual: () => string;
  navegar: (rota: string) => void;
  abrirSidebar: () => void;
  onFim: (status: 'complete' | 'cancel') => void;
}

const TIMEOUT_PADRAO = 3000;

/** Passos que o papel atual não pode ver simplesmente não entram na fila. */
function passosVisiveis(tour: TourDef, ctx: RunTourContext): TourStepDef[] {
  const mobile = ctx.isMobile();
  return tour.steps.filter((passo) => {
    if (passo.papeis && !passo.papeis.includes(ctx.papel)) return false;
    if (passo.desktopOnly && mobile) return false;
    return true;
  });
}

function textoProgresso(indice: number, total: number): string {
  return `${indice + 1} de ${total}`;
}

/**
 * Injeta o contador no rodapé. O Shepherd não tem isso nativo e sobrescrever o
 * componente inteiro seria bem mais frágil do que acrescentar um `<span>`.
 */
function montarProgresso(el: HTMLElement | null | undefined, rotulo: string) {
  const rodape = el?.querySelector('.shepherd-footer');
  if (!rodape || rodape.querySelector('.vetbots-tour-progress')) return;
  const span = document.createElement('span');
  span.className = 'vetbots-tour-progress';
  span.textContent = rotulo;
  rodape.prepend(span);
}

export function criarTourShepherd(tourDef: TourDef, ctx: RunTourContext): Tour | null {
  const passos = passosVisiveis(tourDef, ctx);
  if (passos.length === 0) return null;

  const semMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const tour = new Shepherd.Tour({
    tourName: tourDef.id,
    useModalOverlay: true,
    exitOnEsc: true,
    keyboardNavigation: true,
    defaultStepOptions: {
      classes: 'vetbots-tour',
      cancelIcon: { enabled: true, label: 'Fechar o tour' },
      // O alvo fica destacado, mas não clicável: assim ninguém dispara uma ação
      // real (pausar bot, excluir cliente) sem querer no meio da explicação.
      canClickTarget: false,
      highlightClass: 'vetbots-tour-target-highlight',
      modalOverlayOpeningPadding: 6,
      modalOverlayOpeningRadius: 8,
      scrollTo: { behavior: semMovimento ? 'auto' : 'smooth', block: 'center' },
    },
  });

  const opcoes: StepOptions[] = passos.map((passo, indice) => {
    // Resolvido no `beforeShowPromise` e lido logo depois, quando o Shepherd
    // chama a função de `attachTo.element`.
    let alvoResolvido: HTMLElement | null = null;

    const rotulo = textoProgresso(indice, passos.length);
    const ehUltimo = indice === passos.length - 1;
    const ehPrimeiro = indice === 0;

    const botoes = [
      ...(ehPrimeiro
        ? []
        : [
            {
              text: 'Voltar',
              secondary: true,
              action(this: Tour) {
                this.back();
              },
            },
          ]),
      {
        text: ehUltimo ? 'Concluir' : 'Próximo',
        action(this: Tour) {
          if (ehUltimo) this.complete();
          else this.next();
        },
      },
    ];

    return {
      id: passo.id,
      title: passo.title,
      text: passo.text,
      buttons: botoes,
      attachTo: passo.element
        ? {
            // Função (e não string): o Shepherd só resolve depois do
            // `beforeShowPromise`, então dá tempo de navegar e esperar o alvo.
            // Devolver `null` faz o passo aparecer centralizado, em vez de quebrar.
            element: () => alvoResolvido,
            on: passo.on ?? 'bottom',
          }
        : undefined,
      /**
       * Passo ancorado cujo alvo já se sabe ausente é pulado. `showOn` roda
       * antes do `beforeShowPromise`, então só vale para alvos da rota atual —
       * por isso os passos que mudam de rota são sempre centralizados.
       */
      showOn: () => {
        if (!passo.element) return true;
        if (passo.route && passo.route !== ctx.rotaAtual()) return true;
        return Boolean(findVisible(passo.element));
      },
      beforeShowPromise: async () => {
        if (passo.route && passo.route !== ctx.rotaAtual()) {
          ctx.navegar(passo.route);
          await proximoQuadro();
        }
        if (passo.requireSidebar) {
          ctx.abrirSidebar();
          await proximoQuadro();
        }
        alvoResolvido = passo.element
          ? await waitForElement(passo.element, passo.timeoutMs ?? TIMEOUT_PADRAO)
          : null;
      },
      when: {
        show(this: Step) {
          montarProgresso(this.el, rotulo);
        },
      },
    } satisfies StepOptions;
  });

  tour.addSteps(opcoes);

  tour.on('complete', () => ctx.onFim('complete'));
  tour.on('cancel', () => ctx.onFim('cancel'));

  return tour;
}

/** Encerra qualquer tour em andamento — usado no unmount do provider. */
export function cancelarTourAtivo() {
  void Shepherd.activeTour?.cancel();
}
