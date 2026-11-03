import type { CSSProperties } from 'react';

/**
 * Escala de cores da marca da fila (fila-50 ... fila-900) gerada a partir de UMA cor.
 * Vale só para as telas públicas (TV e totem) e para o cupom: o painel interno segue o
 * tema do dashboard. As variáveis levam "r g b" para o Tailwind aplicar transparência.
 */

export const COR_PADRAO_FILA = '#2294aa';

export const CORES_PRONTAS_FILA = [
  { nome: 'Azul-petróleo', hex: '#2294aa' },
  { nome: 'Verde', hex: '#10b981' },
  { nome: 'Azul', hex: '#2563eb' },
  { nome: 'Roxo', hex: '#7c3aed' },
  { nome: 'Rosa', hex: '#db2777' },
  { nome: 'Laranja', hex: '#ea580c' },
  { nome: 'Vinho', hex: '#9f1239' },
  { nome: 'Grafite', hex: '#475569' },
];

export const TONS_FILA = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
type Tom = (typeof TONS_FILA)[number];
type Rgb = [number, number, number];

// Quanto misturar com branco (claros) ou preto (escuros) a partir da cor base (500).
const CLAROS: Partial<Record<Tom, number>> = { 50: 0.92, 100: 0.82, 200: 0.64, 300: 0.44, 400: 0.22 };
const ESCUROS: Partial<Record<Tom, number>> = { 600: 0.12, 700: 0.26, 800: 0.4, 900: 0.54 };

// Fundo escuro da TV (slate-900): os tons 300/400 são textos sobre ele.
const FUNDO_ESCURO: Rgb = [15, 23, 42];
const BRANCO: Rgb = [255, 255, 255];

export const HEX_VALIDO = /^#[0-9a-fA-F]{6}$/;

function hexParaRgb(hex: string): Rgb {
  const limpo = hex.replace('#', '');
  return [0, 2, 4].map((i) => Number.parseInt(limpo.slice(i, i + 2), 16)) as Rgb;
}

const misturar = (rgb: Rgb, alvo: number, t: number): Rgb =>
  rgb.map((c) => Math.round(c + (alvo - c) * t)) as Rgb;

function luminancia([r, g, b]: Rgb): number {
  const f = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contraste(a: Rgb, b: Rgb): number {
  const [maior, menor] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (maior + 0.05) / (menor + 0.05);
}

export function escalaDaCor(hex: string): Record<Tom, Rgb> {
  const base = hexParaRgb(HEX_VALIDO.test(hex) ? hex : COR_PADRAO_FILA);
  const escala = {} as Record<Tom, Rgb>;
  for (const tom of TONS_FILA) {
    if (tom === 500) escala[tom] = base;
    else if (CLAROS[tom] !== undefined) escala[tom] = misturar(base, 255, CLAROS[tom] as number);
    else escala[tom] = misturar(base, 0, ESCUROS[tom] as number);
  }
  // Legibilidade: textos fila-300/400 ficam sobre fundo escuro.
  for (const tom of [400, 300] as const) {
    let t = CLAROS[tom] as number;
    while (contraste(escala[tom], FUNDO_ESCURO) < 4.5 && t < 0.95) {
      t += 0.05;
      escala[tom] = misturar(base, 255, t);
    }
  }
  // fila-600 sustenta texto branco (botões); 700-900 escurecem a partir dele.
  let t = ESCUROS[600] as number;
  while (contraste(escala[600], BRANCO) < 3.5 && t < 0.8) {
    t += 0.05;
    escala[600] = misturar(base, 0, t);
  }
  escala[700] = misturar(escala[600], 0, 0.14);
  escala[800] = misturar(escala[600], 0, 0.3);
  escala[900] = misturar(escala[600], 0, 0.46);
  return escala;
}

/** Variáveis CSS para colocar no `style` do elemento raiz da TV/totem. */
export function estiloMarca(hex: string): CSSProperties {
  const escala = escalaDaCor(hex);
  const vars: Record<string, string> = {};
  for (const tom of TONS_FILA) vars[`--fila-${tom}`] = escala[tom].join(' ');
  return vars as CSSProperties;
}

/** Cor de texto legível sobre a cor da marca (branco ou quase-preto). */
export function textoSobre(hex: string): string {
  const rgb = escalaDaCor(hex)[600];
  return contraste(rgb, BRANCO) >= contraste(rgb, [11, 42, 48]) ? '#ffffff' : '#0b2a30';
}
