import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { useAuth } from '@/context/AuthContext';
import { papelEfetivo } from '@/config/modulos';
import { useSidebar } from '@/components/ui/sidebar';
import type { TourDef, TourStepDef } from './types';
import { TOURS, tourDaRota, toursDisponiveis } from './registry';
import { loadToursConcluidos, marcarTourConcluido } from './tourStorage';
import { waitForElement, proximoQuadro } from './waitForElement';
import { OpenHelpModal } from './OpenHelpModal';
import { speechProvider } from './speech';

interface TourContextValue {
  /** Tours que o papel atual tem permissão para executar. */
  tours: TourDef[];
  /** Tour associado à rota atual, se existir. */
  tourDaPagina: TourDef | null;
  /** Ids de tours já concluídos neste navegador. */
  concluidos: string[];
  /** Id do tour em execução, ou `null`. */
  emExecucao: string | null;
  /** Inicia o tour informado pelo ID. */
  iniciarTour: (tourId: string) => void;
  /** Cancela o tour ativo imediatamente. */
  cancelarTour: () => void;
}

const TourContext = createContext<TourContextValue | null>(null);

export function TourProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { papel, setupPendente } = useAuth();
  const { isMobile, setOpenMobile, setOpen } = useSidebar();

  const [concluidos, setConcluidos] = useState<string[]>(() => loadToursConcluidos());
  const [activeTour, setActiveTour] = useState<TourDef | null>(null);
  const [stepIndex, setStepIndex] = useState<number>(0);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);

  const rotaRef = useRef(location.pathname);
  rotaRef.current = location.pathname;
  const mobileRef = useRef(isMobile);
  mobileRef.current = isMobile;

  const papelAtual = papelEfetivo(papel, setupPendente);

  const tours = useMemo(() => toursDisponiveis(papelAtual), [papelAtual]);
  const tourDaPagina = useMemo(
    () => tourDaRota(location.pathname, papelAtual),
    [location.pathname, papelAtual]
  );

  // Filtra os passos que o perfil ou dispositivo atual tem permissão de ver
  const activeSteps = useMemo<TourStepDef[]>(() => {
    if (!activeTour) return [];
    return activeTour.steps.filter((p) => {
      if (p.papeis && !p.papeis.includes(papelAtual)) return false;
      if (p.desktopOnly && mobileRef.current) return false;
      return true;
    });
  }, [activeTour, papelAtual]);

  const currentStep = activeSteps[stepIndex] || null;

  // Resolve o elemento e transição de rota a cada mudança de passo
  useEffect(() => {
    if (!activeTour || !currentStep) {
      setTargetElement(null);
      return;
    }

    let isSubscribed = true;

    void (async () => {
      // Navega se o passo exigir outra rota
      if (currentStep.route && currentStep.route !== rotaRef.current) {
        navigate(currentStep.route);
        await proximoQuadro();
      }

      // Abre a sidebar se o passo exigir
      if (currentStep.requireSidebar) {
        if (mobileRef.current) setOpenMobile(true);
        else setOpen(true);
        await proximoQuadro();
      }

      // Localiza o elemento alvo
      if (currentStep.element) {
        const el = await waitForElement(currentStep.element, currentStep.timeoutMs ?? 3000);
        if (isSubscribed) {
          setTargetElement(el);
        }
      } else {
        if (isSubscribed) {
          setTargetElement(null);
        }
      }
    })();

    return () => {
      isSubscribed = false;
    };
  }, [activeTour, currentStep, navigate, setOpen, setOpenMobile]);

  const fecharTour = useCallback(() => {
    speechProvider.stop();
    setActiveTour(null);
    setStepIndex(0);
    setTargetElement(null);
  }, []);

  const concluirTour = useCallback(() => {
    if (activeTour) {
      setConcluidos(marcarTourConcluido(activeTour.id));
      toast.success(`Tour "${activeTour.title}" concluído!`);
    }
    fecharTour();
  }, [activeTour, fecharTour]);

  const proximoPasso = useCallback(() => {
    if (stepIndex < activeSteps.length - 1) {
      setStepIndex((i) => i + 1);
    } else {
      concluirTour();
    }
  }, [stepIndex, activeSteps.length, concluirTour]);

  const passoAnterior = useCallback(() => {
    if (stepIndex > 0) {
      setStepIndex((i) => i - 1);
    }
  }, [stepIndex]);

  const iniciarTour = useCallback(
    (tourId: string) => {
      const def = TOURS.find((t) => t.id === tourId);
      if (!def) return;
      if (def.papeis && !def.papeis.includes(papelAtual)) {
        toast.info('Este tour não está disponível para o seu perfil de acesso.');
        return;
      }

      fecharTour();
      setActiveTour(def);
      setStepIndex(0);
    },
    [papelAtual, fecharTour]
  );

  // Cancela áudio e limpa estado ao desmontar
  useEffect(() => {
    return () => {
      speechProvider.stop();
    };
  }, []);

  const value = useMemo<TourContextValue>(
    () => ({
      tours,
      tourDaPagina,
      concluidos,
      emExecucao: activeTour?.id || null,
      iniciarTour,
      cancelarTour: fecharTour,
    }),
    [tours, tourDaPagina, concluidos, activeTour, iniciarTour, fecharTour]
  );

  return (
    <TourContext.Provider value={value}>
      {children}
      {activeTour && currentStep && (
        <OpenHelpModal
          tour={activeTour}
          step={currentStep}
          stepIndex={stepIndex}
          totalSteps={activeSteps.length}
          targetElement={targetElement}
          onNext={proximoPasso}
          onBack={passoAnterior}
          onClose={fecharTour}
          onComplete={concluirTour}
        />
      )}
    </TourContext.Provider>
  );
}

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useTour precisa estar dentro de <TourProvider>');
  return ctx;
}
