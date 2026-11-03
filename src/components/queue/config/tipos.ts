import type { FilaConfig } from '@/types/filaConfig';

/** Propriedades comuns das abas de ajustes: o rascunho e como alterá-lo. */
export interface AbaConfigProps {
  valor: FilaConfig;
  alterar: (parcial: Partial<FilaConfig>) => void;
  /** Só gestor salva; para os demais a aba fica somente leitura. */
  somenteLeitura?: boolean;
}

export const formatarBytes = (bytes: number): string => {
  if (!bytes) return '—';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
};
