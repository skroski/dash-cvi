/**
 * Texto de dias e horários mostrado no painel. Espelha supabase/functions/_shared/prompt_variaveis.ts
 * (o front não importa de supabase/functions; um teste garante que as duas versões não divergem).
 */
import type { HorarioFuncionamento } from '@/types/atendimentoConfig';

const DIAS_CURTOS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
export const DIAS_ROTULO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const capitalizar = (t: string) => (t ? t[0].toUpperCase() + t.slice(1) : t);

/** "segunda a quinta", "sexta", "terça e quinta", "segunda, quarta e sexta". */
export function descreverDias(dias: number[]): string {
  const ordenados = [...new Set(dias)].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b);
  if (!ordenados.length) return '';
  const blocos: number[][] = [];
  for (const dia of ordenados) {
    const ultimo = blocos.at(-1);
    if (ultimo && dia === ultimo.at(-1)! + 1) ultimo.push(dia);
    else blocos.push([dia]);
  }
  const partes = blocos.flatMap((bloco) => {
    if (bloco.length >= 3) return [`${DIAS_CURTOS[bloco[0]]} a ${DIAS_CURTOS[bloco.at(-1)!]}`];
    return bloco.map((dia) => DIAS_CURTOS[dia]);
  });
  if (partes.length === 1) return partes[0];
  return `${partes.slice(0, -1).join(', ')} e ${partes.at(-1)}`;
}

export function textoHorarioFuncionamento(faixas: HorarioFuncionamento[] | null | undefined): string {
  const validas = (faixas ?? []).filter((f) => Array.isArray(f.dias) && f.dias.length && f.abre && f.fecha);
  if (!validas.length) return '';
  const linhas = validas.map((f) => `${capitalizar(descreverDias(f.dias))}: ${f.abre.slice(0, 5)} às ${f.fecha.slice(0, 5)}`);
  const cobertos = new Set(validas.flatMap((f) => f.dias));
  const fechados = [0, 1, 2, 3, 4, 5, 6].filter((d) => !cobertos.has(d));
  if (fechados.length) linhas.push(`${capitalizar(descreverDias(fechados))}: fechado`);
  return linhas.join('\n');
}

/** Mensagem do primeiro problema encontrado nas faixas, ou null. */
export function validarHorarios(valor: HorarioFuncionamento[]): string | null {
  for (const faixa of valor) {
    if (!faixa.dias.length) return 'Marque ao menos um dia da semana em cada faixa de funcionamento.';
    if (!faixa.abre || !faixa.fecha || faixa.abre.slice(0, 5) >= faixa.fecha.slice(0, 5)) return 'Em cada faixa, o horário de abertura precisa ser antes do fechamento.';
  }
  const usados = valor.flatMap((f) => f.dias);
  if (new Set(usados).size !== usados.length) return 'Um mesmo dia da semana aparece em mais de uma faixa.';
  return null;
}
