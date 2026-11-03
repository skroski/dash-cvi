/**
 * Datas no fuso da empresa (IANA), sem depender do fuso do servidor e sem
 * deslocamento fixo (`-03:00`): o offset é calculado para o instante pedido.
 * "dataKey" é sempre `AAAA-MM-DD`; "minuto do dia" conta desde 00:00 local.
 */
export interface PartesLocais {
  dataKey: string;
  ano: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
  segundo: number;
}

const NOMES_DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

export const nomeDiaSemana = (indice: number): string => NOMES_DIAS[((indice % 7) + 7) % 7];

const pad = (valor: number, tamanho = 2) => String(valor).padStart(tamanho, '0');

const formatadores = new Map<string, Intl.DateTimeFormat>();
function formatador(fuso: string): Intl.DateTimeFormat {
  let formato = formatadores.get(fuso);
  if (!formato) {
    formato = new Intl.DateTimeFormat('en-CA', {
      timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    });
    formatadores.set(fuso, formato);
  }
  return formato;
}

export function fusoValido(fuso: string | null | undefined): boolean {
  if (!fuso) return false;
  try {
    formatador(fuso);
    return true;
  } catch {
    return false;
  }
}

export function partesNoFuso(instante: Date, fuso: string): PartesLocais {
  const valores: Record<string, number> = {};
  for (const parte of formatador(fuso).formatToParts(instante)) {
    if (parte.type !== 'literal') valores[parte.type] = Number(parte.value);
  }
  const hora = valores.hour === 24 ? 0 : valores.hour;
  return {
    dataKey: `${pad(valores.year, 4)}-${pad(valores.month)}-${pad(valores.day)}`,
    ano: valores.year, mes: valores.month, dia: valores.day,
    hora, minuto: valores.minute, segundo: valores.second,
  };
}

function partesDeChave(dataKey: string) {
  const [ano, mes, dia] = dataKey.split('-').map(Number);
  return { ano, mes, dia };
}

export function somarDias(dataKey: string, dias: number): string {
  const { ano, mes, dia } = partesDeChave(dataKey);
  const data = new Date(Date.UTC(ano, mes - 1, dia + dias, 12));
  return `${pad(data.getUTCFullYear(), 4)}-${pad(data.getUTCMonth() + 1)}-${pad(data.getUTCDate())}`;
}

export function diaDaSemana(dataKey: string): number {
  const { ano, mes, dia } = partesDeChave(dataKey);
  return new Date(Date.UTC(ano, mes - 1, dia, 12)).getUTCDay();
}

export function diferencaDias(a: string, b: string): number {
  const pa = partesDeChave(a);
  const pb = partesDeChave(b);
  return Math.round((Date.UTC(pa.ano, pa.mes - 1, pa.dia) - Date.UTC(pb.ano, pb.mes - 1, pb.dia)) / 86_400_000);
}

export function formatarDataBR(dataKey: string): string {
  return dataKey.split('-').reverse().join('/');
}

export function horaTexto(minutoDoDia: number): string {
  return `${pad(Math.floor(minutoDoDia / 60))}:${pad(minutoDoDia % 60)}`;
}

/** Instante UTC em que o relógio da empresa marca `dataKey` + `minutoDoDia`. */
export function instanteLocal(fuso: string, dataKey: string, minutoDoDia: number): Date {
  const { ano, mes, dia } = partesDeChave(dataKey);
  const alvoComoUtc = Date.UTC(ano, mes - 1, dia, 0, minutoDoDia);
  // Duas passadas resolvem também a virada de horário de verão.
  let instante = alvoComoUtc;
  for (let i = 0; i < 2; i++) {
    const p = partesNoFuso(new Date(instante), fuso);
    const relogio = Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo);
    instante += alvoComoUtc - relogio;
  }
  return new Date(instante);
}

/** Deslocamento do fuso naquele horário local, no formato `-03:00`. */
export function offsetDoFuso(fuso: string, dataKey: string, minutoDoDia: number): string {
  const instante = instanteLocal(fuso, dataKey, minutoDoDia);
  const p = partesNoFuso(instante, fuso);
  const minutos = Math.round((Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto) - Math.floor(instante.getTime() / 60_000) * 60_000) / 60_000);
  const sinal = minutos < 0 ? '-' : '+';
  const abs = Math.abs(minutos);
  return `${sinal}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/** `AAAA-MM-DDTHH:mm:00-03:00` para a hora local pedida. */
export function isoLocal(fuso: string, dataKey: string, minutoDoDia: number): string {
  return `${dataKey}T${horaTexto(minutoDoDia)}:00${offsetDoFuso(fuso, dataKey, minutoDoDia)}`;
}

export function dataKeyDoInstante(instante: Date | number, fuso: string): string {
  return partesNoFuso(typeof instante === 'number' ? new Date(instante) : instante, fuso).dataKey;
}

export function minutoDoDiaNoFuso(instante: Date | number, fuso: string): number {
  const p = partesNoFuso(typeof instante === 'number' ? new Date(instante) : instante, fuso);
  return p.hora * 60 + p.minuto;
}

/** `AAAA-MM-DDTHH:mm:00±HH:MM` no fuso da empresa para um instante absoluto. */
export function isoLocalDoInstante(instante: Date | number, fuso: string): string {
  const ms = typeof instante === 'number' ? instante : instante.getTime();
  return isoLocal(fuso, dataKeyDoInstante(ms, fuso), minutoDoDiaNoFuso(ms, fuso));
}
