import { useState, useCallback } from 'react';

export type AgendaType = 'todas' | 'consultaveterinaria' | 'vacinas' | 'exame';

export function useAgendaType(initialType: AgendaType = 'todas') {
  const [agendaType, setAgendaType] = useState<AgendaType>(initialType);

  const changeAgendaType = useCallback((type: AgendaType) => {
    setAgendaType(type);
  }, []);

  const getEndpointSuffix = useCallback((type: AgendaType = agendaType) => {
    switch (type) {
      case 'consultaveterinaria':
        return '/consultaveterinaria';
      case 'vacinas':
        return '/vacinas';
      case 'exame':
        return '/exame';
      default:
        return '/consultaveterinaria';
    }
  }, [agendaType]);

  return {
    agendaType,
    changeAgendaType,
    getEndpointSuffix,
    isTodas: agendaType === 'todas',
    isVet: agendaType === 'consultaveterinaria',
    isVacinas: agendaType === 'vacinas',
    isExame: agendaType === 'exame',
  };
}