import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Volume2, VolumeX, X, ArrowLeft, ArrowRight, Check, Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TourDef, TourStepDef } from './types';
import { speechProvider } from './speech';
import './open-help.css';

interface OpenHelpModalProps {
  tour: TourDef;
  step: TourStepDef;
  stepIndex: number;
  totalSteps: number;
  targetElement: HTMLElement | null;
  onNext: () => void;
  onBack: () => void;
  onClose: () => void;
  onComplete: () => void;
}

export const OpenHelpModal: React.FC<OpenHelpModalProps> = ({
  tour,
  step,
  stepIndex,
  totalSteps,
  targetElement,
  onNext,
  onBack,
  onClose,
  onComplete,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; isCentered: boolean }>({
    top: 0,
    left: 0,
    isCentered: true,
  });
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(() => speechProvider.getMuted());

  // Calcula o posicionamento responsivo do Popover em relação ao targetElement
  const calculatePosition = useCallback(() => {
    if (!targetElement) {
      // Centraliza na tela
      const w = window.innerWidth;
      const h = window.innerHeight;
      const popWidth = Math.min(w - 32, 440);
      const popHeight = 240;
      setPos({
        top: Math.max(20, (h - popHeight) / 2),
        left: Math.max(16, (w - popWidth) / 2),
        isCentered: true,
      });
      return;
    }

    const rect = targetElement.getBoundingClientRect();
    const margin = 12;
    const popWidth = Math.min(window.innerWidth - 32, 440);
    const popHeight = popoverRef.current ? popoverRef.current.offsetHeight : 220;

    const preferred = step.on || 'bottom';
    let top = 0;
    let left = 0;

    if (preferred.startsWith('top')) {
      top = rect.top - popHeight - margin;
      left = rect.left + (rect.width - popWidth) / 2;
    } else if (preferred.startsWith('bottom')) {
      top = rect.bottom + margin;
      left = rect.left + (rect.width - popWidth) / 2;
    } else if (preferred.startsWith('left')) {
      top = rect.top + (rect.height - popHeight) / 2;
      left = rect.left - popWidth - margin;
    } else if (preferred.startsWith('right')) {
      top = rect.top + (rect.height - popHeight) / 2;
      left = rect.right + margin;
    } else {
      top = rect.bottom + margin;
      left = rect.left + (rect.width - popWidth) / 2;
    }

    // Auto-ajuste para ficar dentro da viewport
    if (top + popHeight > window.innerHeight - 16) {
      top = rect.top - popHeight - margin;
    }
    if (top < 16) {
      top = 16;
    }

    if (left + popWidth > window.innerWidth - 16) {
      left = window.innerWidth - popWidth - 16;
    }
    if (left < 16) {
      left = 16;
    }

    setPos({ top, left, isCentered: false });
  }, [targetElement, step.on]);

  // Efeito de destaque no elemento alvo
  useEffect(() => {
    if (targetElement) {
      targetElement.classList.add('open-help-target-highlight');
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }

    return () => {
      if (targetElement) {
        targetElement.classList.remove('open-help-target-highlight');
      }
    };
  }, [targetElement]);

  // Atualiza posição após renderizar e redimensionar tela
  useEffect(() => {
    calculatePosition();
    window.addEventListener('resize', calculatePosition);
    window.addEventListener('scroll', calculatePosition, true);
    return () => {
      window.removeEventListener('resize', calculatePosition);
      window.removeEventListener('scroll', calculatePosition, true);
    };
  }, [calculatePosition]);

  // Narração de voz opcional ao mudar de passo
  useEffect(() => {
    speechProvider.stop();
    setIsSpeaking(false);

    // Se o áudio não estiver mutado, narra o título + texto do passo
    if (!isMuted) {
      const speechText = `${step.title}. ${step.narration || step.text}`;
      speechProvider.speak(speechText, {
        tourId: tour.id,
        stepId: step.id,
        onStart: () => setIsSpeaking(true),
        onEnd: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      });
    }

    return () => {
      speechProvider.stop();
    };
  }, [step, tour.id, isMuted]);

  // Atalhos de teclado (setas para navegar, Esc para sair)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (stepIndex === totalSteps - 1) onComplete();
        else onNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (stepIndex > 0) onBack();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [stepIndex, totalSteps, onNext, onBack, onClose, onComplete]);

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    speechProvider.setMuted(nextMuted);
    if (!nextMuted) {
      const speechText = `${step.title}. ${step.narration || step.text}`;
      speechProvider.speak(speechText, {
        tourId: tour.id,
        stepId: step.id,
        onStart: () => setIsSpeaking(true),
        onEnd: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      });
    } else {
      speechProvider.stop();
      setIsSpeaking(false);
    }
  };

  const isLast = stepIndex === totalSteps - 1;
  const isFirst = stepIndex === 0;
  const progressPercent = ((stepIndex + 1) / totalSteps) * 100;

  return (
    <>
      {/* Backdrop escuro com foco */}
      <div
        className="open-help-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Popover flutuante */}
      <div
        ref={popoverRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="open-help-title"
        className="open-help-popover"
        style={{
          top: `${pos.top}px`,
          left: `${pos.left}px`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barra de Progresso */}
        <div className="open-help-progress-bar">
          <div
            className="open-help-progress-fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-border/40 px-4 py-3 bg-muted/20">
          <div className="flex items-center gap-2 min-w-0">
            <Compass className="h-4 w-4 text-primary shrink-0" />
            <span className="text-xs font-semibold text-muted-foreground truncate">
              {tour.title}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* Controle de Narração de Voz */}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={toggleMute}
              title={isMuted ? 'Ativar narração em áudio' : 'Desativar narração em áudio'}
              aria-label={isMuted ? 'Ativar narração' : 'Desativar narração'}
            >
              {isMuted ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className={`h-4 w-4 ${isSpeaking ? 'text-primary animate-pulse' : ''}`} />
              )}
            </Button>

            {/* Fechar */}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={onClose}
              title="Fechar tour (Esc)"
              aria-label="Fechar tour"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Corpo do Passo */}
        <div className="p-4 space-y-2.5">
          <h3 id="open-help-title" className="text-base font-bold text-foreground">
            {step.title}
          </h3>
          <div
            className="open-help-body"
            dangerouslySetInnerHTML={{ __html: step.text }}
          />
        </div>

        {/* Rodapé e Botões de Navegação */}
        <div className="flex items-center justify-between border-t border-border/40 bg-muted/10 px-4 py-3">
          <span className="text-xs font-medium text-muted-foreground font-mono">
            {stepIndex + 1} de {totalSteps}
          </span>

          <div className="flex items-center gap-2">
            {!isFirst && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1 text-xs"
                onClick={onBack}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Voltar
              </Button>
            )}

            <Button
              variant="default"
              size="sm"
              className="h-8 gap-1 text-xs font-semibold"
              onClick={isLast ? onComplete : onNext}
            >
              {isLast ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Concluir
                </>
              ) : (
                <>
                  Próximo
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};
