import { is } from 'date-fns/locale';
import { useState, useCallback } from 'react';

export type AgendaType = 'consultaveterinaria' | 'vacinas' | 'exame' | 'hotel';

export function useAgendaType() {
  const [agendaType, setAgendaType] = useState<AgendaType>('consultaveterinaria');

  const changeAgendaType = useCallback((type: AgendaType) => {
    setAgendaType(type);
  }, []);

  const getEndpointSuffix = useCallback(() => {
    switch (agendaType) {
      case 'consultaveterinaria':
        return '/consultaveterinaria';
      case 'vacinas':
        return '/vacinas';
      case 'exame':
        return '/exame';
      case 'hotel':
        return '/hotel';
      default:
        return '/consultaveterinaria';
    }
  }, [agendaType]);

  return {
    agendaType,
    changeAgendaType,
    getEndpointSuffix,
    isVet: agendaType === 'consultaveterinaria',
    isVacinas: agendaType === 'vacinas',
    isExame: agendaType === 'exame',
    isHotel: agendaType === 'hotel',
  };
}