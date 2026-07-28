import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { useAtendentes } from '@/hooks/useAtendentes';
import { useAuth } from '@/context/AuthContext';
import { Atendente } from '@/types/atendimento';

const STORAGE_KEY = 'atendenteAtivoId';

interface AtendenteAtivoContextValue {
  atendenteAtivoId: number | null;
  setAtendenteAtivoId: (id: number | null) => void;
  /**
   * False quando o usuário é um atendente com cadastro vinculado — nesse caso a
   * identidade vem do login e não pode ser trocada no header.
   */
  podeAlternar: boolean;
}

const AtendenteAtivoContext = createContext<AtendenteAtivoContextValue | undefined>(
  undefined
);

/**
 * "Atendente em uso" no painel.
 *
 * Quem tem papel `atendente` fica travado no cadastro vinculado ao próprio
 * login: o filtro "Atribuídas" e a assinatura das mensagens passam a refletir a
 * identidade autenticada, não uma escolha do navegador. Admin e líder continuam
 * podendo alternar (útil para acompanhar a operação), e a escolha persiste por
 * navegador como antes.
 *
 * Enquanto a migração de perfis não for aplicada, `perfil` é null e o
 * comportamento é exatamente o anterior.
 */
export function AtendenteAtivoProvider({ children }: { children: ReactNode }) {
  const { perfil } = useAuth();
  const [manualId, setManualId] = useState<number | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? Number(saved) : NaN;
    return Number.isFinite(parsed) ? parsed : null;
  });

  const vinculadoId = perfil?.atendenteId ?? null;
  const travado = perfil?.papel === 'atendente' && vinculadoId !== null;

  const atendenteAtivoId = travado ? vinculadoId : manualId ?? vinculadoId;

  const setAtendenteAtivoId = useCallback(
    (id: number | null) => {
      if (travado) return;
      setManualId(id);
      if (id === null) {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, String(id));
      }
    },
    [travado]
  );

  const value = useMemo(
    () => ({ atendenteAtivoId, setAtendenteAtivoId, podeAlternar: !travado }),
    [atendenteAtivoId, setAtendenteAtivoId, travado]
  );

  return (
    <AtendenteAtivoContext.Provider value={value}>
      {children}
    </AtendenteAtivoContext.Provider>
  );
}

export function useAtendenteAtivo() {
  const ctx = useContext(AtendenteAtivoContext);
  if (!ctx) {
    throw new Error('useAtendenteAtivo deve ser usado dentro de AtendenteAtivoProvider');
  }
  const { atendenteById } = useAtendentes();
  const atendenteAtivo: Atendente | undefined =
    ctx.atendenteAtivoId !== null ? atendenteById.get(ctx.atendenteAtivoId) : undefined;
  return { ...ctx, atendenteAtivo };
}
