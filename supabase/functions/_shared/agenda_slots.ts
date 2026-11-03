/** Geração de horários de uma jornada (minutos desde 00:00), sem I/O. */
export function horaMinutos(valor: string): number {
  const [hora = '0', minuto = '0'] = valor.slice(0, 5).split(':');
  return Number(hora) * 60 + Number(minuto);
}

export function sobrepoe(inicio: number, fim: number, outroInicio: number, outroFim: number): boolean {
  return inicio < outroFim && fim > outroInicio;
}

export function gerarHorarios(opts: {
  inicio: number;
  fim: number;
  ultimoInicio?: number | null;
  duracao: number;
  passo: number;
  bloqueios?: Array<[number, number]>;
  ocupado?: (inicio: number, fim: number) => boolean;
}): Array<{ inicio: number; fim: number }> {
  const ultimo = opts.ultimoInicio ?? opts.fim - opts.duracao;
  const resultado: Array<{ inicio: number; fim: number }> = [];
  for (let inicio = opts.inicio; inicio <= ultimo; inicio += opts.passo) {
    const fim = inicio + opts.duracao;
    if (fim > opts.fim) continue;
    if ((opts.bloqueios ?? []).some(([a, b]) => sobrepoe(inicio, fim, a, b))) continue;
    if (opts.ocupado?.(inicio, fim)) continue;
    resultado.push({ inicio, fim });
  }
  return resultado;
}
