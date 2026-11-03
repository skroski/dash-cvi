import type { Papel } from '@/types/perfil';
import type { TourDef } from './types';
import { tourGeral } from './tours/geral';
import {
  tourAgenda,
  tourClientes,
  tourConversas,
  tourGrupos,
  tourInicio,
  tourLembretes,
} from './tours/operacao';
import {
  tourAtendentes,
  tourConfiguracoes,
  tourConhecimento,
  tourMetricas,
  tourPesquisas,
  tourUsuarios,
  tourWhatsApp,
} from './tours/gestao';
import {
  tourFila,
  tourPrompt,
  tourTvEChamador,
  tourWebChat,
} from './tours/fila';

/**
 * Registro completo dos tours guiados do sistema.
 * A ordem é respeitada no menu e na Central de Ajuda.
 */
export const TOURS: TourDef[] = [
  tourGeral,
  tourInicio,
  tourFila,
  tourConversas,
  tourGrupos,
  tourWebChat,
  tourClientes,
  tourLembretes,
  tourAgenda,
  tourMetricas,
  tourAtendentes,
  tourPesquisas,
  tourUsuarios,
  tourWhatsApp,
  tourConhecimento,
  tourPrompt,
  tourConfiguracoes,
  tourTvEChamador,
];

export function toursDisponiveis(papel: Papel): TourDef[] {
  return TOURS.filter((tour) => !tour.papeis || tour.papeis.includes(papel));
}

/** Tour oferecido como "tour desta página" na rota informada. */
export function tourDaRota(pathname: string, papel: Papel): TourDef | null {
  return (
    toursDisponiveis(papel).find((tour) =>
      tour.routes.some((r) => pathname === r || (r !== '/' && pathname.startsWith(r)))
    ) ?? null
  );
}
