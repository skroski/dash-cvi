/**
 * Texto de dias e horários de um tipo de agendamento, gerado das jornadas cadastradas.
 * Espelha supabase/functions/_shared/horarios_texto.ts (o front não importa de supabase/functions;
 * um teste garante que as duas versões produzem o mesmo texto).
 */
import { descreverDias } from './horariosTexto';

export interface JanelaTexto {
  dia_semana: number;
  inicio: string;
  fim: string;
  ultimo_inicio?: string | null;
  recorrencia?: string | null;
}

export interface IntervaloTexto {
  tipo: string;
  dia_semana?: number | null;
  data_especifica?: string | null;
  inicio: string;
  fim: string;
  ativo?: boolean | null;
}

export interface RegraTexto {
  profissional: string;
  nome_exibicao?: string | null;
  /** Duração padrão efetiva (regra > tipo) usada para calcular o último horário. */
  duracao: number;
  janelas: JanelaTexto[];
  intervalos: IntervaloTexto[];
}

const hhmm = (valor: string) => valor.slice(0, 5);
const minutos = (valor: string) => {
  const [h = '0', m = '0'] = valor.slice(0, 5).split(':');
  return Number(h) * 60 + Number(m);
};
const deMinutos = (total: number) => `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;

function linhasDaRegra(regra: RegraTexto): string[] {
  const grupos = new Map<string, { dias: number[]; janela: JanelaTexto }>();
  for (const janela of regra.janelas) {
    const ultimo = janela.ultimo_inicio ? hhmm(janela.ultimo_inicio) : deMinutos(minutos(janela.fim) - regra.duracao);
    const chave = [hhmm(janela.inicio), hhmm(janela.fim), ultimo, janela.recorrencia ?? 'semanal'].join('|');
    const grupo = grupos.get(chave) ?? { dias: [], janela };
    grupo.dias.push(janela.dia_semana);
    grupos.set(chave, grupo);
  }
  return [...grupos.entries()]
    .sort((a, b) => Math.min(...a[1].dias) - Math.min(...b[1].dias))
    .map(([chave, { dias }]) => {
      const [inicio, fim, ultimo, recorrencia] = chave.split('|');
      const almoco = regra.intervalos
        .filter((i) => i.tipo === 'almoco' && i.ativo !== false && !i.data_especifica && i.dia_semana != null && dias.includes(i.dia_semana))
        .map((i) => `${hhmm(i.inicio)} às ${hhmm(i.fim)}`);
      const pausaAlmoco = [...new Set(almoco)];
      return [
        `${descreverDias(dias)}, ${inicio} às ${fim}`,
        ultimo !== fim ? ` (último horário ${ultimo})` : '',
        recorrencia === 'quinzenal' ? ' — a cada 15 dias' : '',
        pausaAlmoco.length ? ` — pausa para almoço ${pausaAlmoco.join(' e ')}` : '',
      ].join('');
    });
}

export function textoHorariosTipo(regras: RegraTexto[]): string {
  const comJornada = regras.filter((regra) => regra.janelas.length);
  if (!comJornada.length) return '';
  const varias = comJornada.length > 1;
  return comJornada.flatMap((regra) => {
    const linhas = linhasDaRegra(regra);
    const nome = regra.nome_exibicao?.trim() || regra.profissional;
    return varias ? linhas.map((linha) => `${nome}: ${linha}`) : linhas;
  }).join('\n');
}
