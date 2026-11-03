import React, { useState } from 'react';
import {
  CircleHelp,
  Compass,
  PlayCircle,
  BookOpen,
  Keyboard,
  Check,
  Sparkles,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTour } from '@/tour/TourProvider';
import { HelpCenterDialog } from './HelpCenterDialog';

export const HelpMenuButton = () => {
  const { tourDaPagina, concluidos, iniciarTour } = useTour();
  const [helpCenterOpen, setHelpCenterOpen] = useState(false);
  const [defaultTab, setDefaultTab] = useState<'tours' | 'guia' | 'faq' | 'atalhos'>('tours');

  const openHelpWithTab = (tab: 'tours' | 'guia' | 'faq' | 'atalhos') => {
    setDefaultTab(tab);
    setHelpCenterOpen(true);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            aria-label="Central de Ajuda e Tours Guiados"
            data-tour="help-menu"
          >
            <CircleHelp className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Ajuda</span>
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-72 shadow-xl">
          <DropdownMenuLabel className="flex items-center justify-between">
            <span>Ajuda & Tutoriais</span>
            <span className="text-[10px] font-normal text-muted-foreground">cvi</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {/* Tour da Página Atual */}
          {tourDaPagina ? (
            <DropdownMenuItem
              className="gap-2.5 py-2 cursor-pointer"
              onSelect={() => iniciarTour(tourDaPagina.id)}
            >
              <PlayCircle className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <div className="flex min-w-0 flex-col flex-1">
                <span className="truncate font-medium text-xs text-foreground">
                  Tour desta página
                </span>
                <span className="truncate text-[11px] text-muted-foreground">
                  {tourDaPagina.title}
                </span>
              </div>
              {concluidos.includes(tourDaPagina.id) && (
                <Check className="ml-auto h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden="true" />
              )}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem disabled className="gap-2 text-xs text-muted-foreground">
              <PlayCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              Esta página não possui tour específico
            </DropdownMenuItem>
          )}

          {/* Visão Geral do Sistema */}
          <DropdownMenuItem
            className="gap-2.5 py-2 cursor-pointer"
            onSelect={() => iniciarTour('geral')}
          >
            <Compass className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <div className="flex min-w-0 flex-col flex-1">
              <span className="truncate font-medium text-xs text-foreground">
                Visão Geral do Sistema
              </span>
              <span className="truncate text-[11px] text-muted-foreground">
                Passeio completo por todos os módulos
              </span>
            </div>
            {concluidos.includes('geral') && (
              <Check className="ml-auto h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden="true" />
            )}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Abrir Central de Ajuda Completa */}
          <DropdownMenuItem
            className="gap-2.5 py-2 cursor-pointer font-medium"
            onSelect={() => openHelpWithTab('guia')}
          >
            <BookOpen className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="text-xs">Guia Completo dos Módulos</span>
          </DropdownMenuItem>

          {/* Ver Todos os Tours */}
          <DropdownMenuItem
            className="gap-2.5 py-2 cursor-pointer font-medium"
            onSelect={() => openHelpWithTab('tours')}
          >
            <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="text-xs">Todos os Tours Guiados</span>
          </DropdownMenuItem>

          {/* Atalhos de Teclado */}
          <DropdownMenuItem
            className="gap-2.5 py-2 cursor-pointer text-muted-foreground"
            onSelect={() => openHelpWithTab('atalhos')}
          >
            <Keyboard className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="text-xs">Atalhos de Teclado</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Modal da Central de Ajuda */}
      <HelpCenterDialog
        open={helpCenterOpen}
        onOpenChange={setHelpCenterOpen}
        defaultTab={defaultTab}
      />
    </>
  );
};

export default HelpMenuButton;
