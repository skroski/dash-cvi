import type { Papel } from '@/types/perfil';

/** Subconjunto dos posicionamentos suportados para o popover do tour. */
export type TourPlacement =
  | 'auto'
  | 'top'
  | 'top-start'
  | 'top-end'
  | 'bottom'
  | 'bottom-start'
  | 'bottom-end'
  | 'left'
  | 'left-start'
  | 'left-end'
  | 'right'
  | 'right-start'
  | 'right-end';

export interface TourStepDef {
  id: string;
  title: string;
  /** HTML ou texto explicativo (`<p>`, `<strong>`, `<ul>`, etc.). */
  text: string;
  /** Texto opcional específico para leitura de voz (se omitido, o text é limpo de tags HTML). */
  narration?: string;
  /**
   * Seletor CSS do elemento alvo. Sem `element`, o passo aparece centralizado em destaque (modal).
   */
  element?: string;
  on?: TourPlacement;
  /** Rota aberta antes de mostrar o passo (usada em tours que navegam entre telas). */
  route?: string;
  /** Papéis com permissão para ver este passo. Omitido = todos os papéis. */
  papeis?: Papel[];
  /** Abre a barra lateral antes de exibir (necessário para alvos no menu mobile). */
  requireSidebar?: boolean;
  /** Tempo limite de espera pelo elemento em milissegundos (padrão 3000ms). */
  timeoutMs?: number;
  /** Indica se o passo é visível somente no layout de desktop. */
  desktopOnly?: boolean;
}

export interface TourDef {
  id: string;
  title: string;
  description: string;
  /** Rotas em que este tour é oferecido como "tour desta página". */
  routes: string[];
  /** Papéis autorizados a rodar o tour. Omitido = todos os papéis. */
  papeis?: Papel[];
  steps: TourStepDef[];
}
