import React, { useState, useMemo } from 'react';
import {
  Search,
  Compass,
  BookOpen,
  HelpCircle,
  Keyboard,
  PlayCircle,
  CheckCircle2,
  ExternalLink,
  Lightbulb,
  ArrowRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

import { useTour } from '@/tour/TourProvider';
import { HELP_MODULES, FAQS, SHORTCUTS, HelpGuideModule } from './helpContent';

interface HelpCenterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: 'tours' | 'guia' | 'faq' | 'atalhos';
}

const Tecla = ({ children }: { children: React.ReactNode }) => (
  <kbd className="rounded border border-border bg-muted px-2 py-0.5 font-mono text-[11px] font-medium text-foreground shadow-sm">
    {children}
  </kbd>
);

export const HelpCenterDialog: React.FC<HelpCenterDialogProps> = ({
  open,
  onOpenChange,
  defaultTab = 'tours',
}) => {
  const navigate = useNavigate();
  const { tours, tourDaPagina, concluidos, iniciarTour } = useTour();
  const [activeTab, setActiveTab] = useState<string>(defaultTab);
  const [searchQuery, setSearchQuery] = useState('');

  // Filtro inteligente de busca em tempo real
  const filteredTours = useMemo(() => {
    if (!searchQuery.trim()) return tours;
    const q = searchQuery.toLowerCase();
    return tours.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
    );
  }, [tours, searchQuery]);

  const filteredGuides = useMemo(() => {
    if (!searchQuery.trim()) return HELP_MODULES;
    const q = searchQuery.toLowerCase();
    return HELP_MODULES.filter(
      (g) =>
        g.title.toLowerCase().includes(q) ||
        g.summary.toLowerCase().includes(q) ||
        g.steps.some(
          (s) =>
            s.title.toLowerCase().includes(q) ||
            s.description.toLowerCase().includes(q)
        )
    );
  }, [searchQuery]);

  const filteredFaqs = useMemo(() => {
    if (!searchQuery.trim()) return FAQS;
    const q = searchQuery.toLowerCase();
    return FAQS.filter(
      (f) =>
        f.question.toLowerCase().includes(q) ||
        f.answer.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const handleStartTour = (tourId: string) => {
    onOpenChange(false);
    iniciarTour(tourId);
  };

  const handleNavigateToRoute = (route: string) => {
    onOpenChange(false);
    navigate(route);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[88vh] flex flex-col p-0 gap-0 overflow-hidden border-border/80 shadow-2xl">
        {/* Cabeçalho */}
        <div className="p-6 pb-4 border-b border-border/50 bg-muted/20">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Compass className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">Central de Ajuda & Tutoriais</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Aprenda a operar todas as funcionalidades da clínica com guias, tours e dicas práticas.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Campo de Busca Global */}
          <div className="relative mt-4">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar em tutoriais, guias, dúvidas ou atalhos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 bg-background/80 text-sm"
            />
          </div>
        </div>

        {/* Abas Principais */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col min-h-0"
        >
          <div className="px-6 pt-3 border-b border-border/40 bg-muted/5">
            <TabsList className="grid grid-cols-4 h-9 bg-muted/50 p-0.5">
              <TabsTrigger value="tours" className="gap-1.5 text-xs">
                <Compass className="h-3.5 w-3.5 text-primary" />
                Tours Guiados ({filteredTours.length})
              </TabsTrigger>
              <TabsTrigger value="guia" className="gap-1.5 text-xs">
                <BookOpen className="h-3.5 w-3.5 text-primary" />
                Guia dos Módulos ({filteredGuides.length})
              </TabsTrigger>
              <TabsTrigger value="faq" className="gap-1.5 text-xs">
                <HelpCircle className="h-3.5 w-3.5 text-primary" />
                Dúvidas (FAQ) ({filteredFaqs.length})
              </TabsTrigger>
              <TabsTrigger value="atalhos" className="gap-1.5 text-xs">
                <Keyboard className="h-3.5 w-3.5 text-primary" />
                Atalhos de Teclado
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 min-h-0 p-6 overflow-hidden">
            {/* ABA: TOURS GUIADOS */}
            <TabsContent value="tours" className="h-full m-0">
              <ScrollArea className="h-[460px] pr-3">
                <div className="space-y-4">
                  {/* Destaque: Tour da Página Atual */}
                  {tourDaPagina && !searchQuery && (
                    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-center justify-between gap-4">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="default" className="text-[10px] uppercase font-bold py-0">
                            Página Atual
                          </Badge>
                          <span className="font-semibold text-sm text-foreground">
                            {tourDaPagina.title}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {tourDaPagina.description}
                        </p>
                      </div>

                      <Button
                        size="sm"
                        className="gap-1.5 shrink-0 shadow-sm"
                        onClick={() => handleStartTour(tourDaPagina.id)}
                      >
                        <PlayCircle className="h-4 w-4" />
                        Iniciar Tour
                      </Button>
                    </div>
                  )}

                  {/* Lista de Todos os Tours */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Todos os Tours Disponíveis
                    </h4>

                    {filteredTours.length === 0 ? (
                      <div className="py-8 text-center text-sm text-muted-foreground">
                        Nenhum tour encontrado para "{searchQuery}".
                      </div>
                    ) : (
                      filteredTours.map((tour) => {
                        const isDone = concluidos.includes(tour.id);
                        return (
                          <div
                            key={tour.id}
                            className="group flex items-center justify-between rounded-lg border border-border/60 bg-card p-3 transition-colors hover:border-primary/40 hover:bg-muted/30"
                          >
                            <div className="space-y-0.5 min-w-0 flex-1 pr-3">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm text-foreground">
                                  {tour.title}
                                </span>
                                {isDone && (
                                  <Badge
                                    variant="outline"
                                    className="gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10 py-0"
                                  >
                                    <CheckCircle2 className="h-3 w-3" />
                                    Concluído
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {tour.description}
                              </p>
                            </div>

                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1 text-xs shrink-0 text-primary group-hover:bg-primary/10"
                              onClick={() => handleStartTour(tour.id)}
                            >
                              <PlayCircle className="h-3.5 w-3.5" />
                              {isDone ? 'Refazer' : 'Iniciar'}
                            </Button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            {/* ABA: GUIA DOS MÓDULOS */}
            <TabsContent value="guia" className="h-full m-0">
              <ScrollArea className="h-[460px] pr-3">
                {filteredGuides.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    Nenhum módulo encontrado para "{searchQuery}".
                  </div>
                ) : (
                  <Accordion type="multiple" className="space-y-3">
                    {filteredGuides.map((guide) => (
                      <AccordionItem
                        key={guide.id}
                        value={guide.id}
                        className="rounded-lg border border-border/60 bg-card px-4"
                      >
                        <AccordionTrigger className="py-3 hover:no-underline">
                          <div className="flex items-center gap-3 text-left">
                            <span className="font-semibold text-sm text-foreground">
                              {guide.title}
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-1 pb-4 space-y-4 text-xs">
                          <p className="text-muted-foreground leading-relaxed">
                            {guide.summary}
                          </p>

                          {/* Passos do Módulo */}
                          <div className="space-y-2.5 rounded-lg bg-muted/40 p-3 border border-border/40">
                            <span className="font-semibold text-foreground uppercase tracking-wider text-[10px]">
                              Passo a Passo
                            </span>
                            <div className="space-y-2">
                              {guide.steps.map((step, idx) => (
                                <div key={idx} className="space-y-0.5">
                                  <span className="font-medium text-foreground">
                                    {step.title}
                                  </span>
                                  <p className="text-muted-foreground leading-relaxed">
                                    {step.description}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Dicas Práticas */}
                          {guide.tips.length > 0 && (
                            <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5 text-amber-900 dark:text-amber-200">
                              <Lightbulb className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                              <div className="space-y-1">
                                {guide.tips.map((tip, idx) => (
                                  <p key={idx}>{tip}</p>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Ações Rápidas */}
                          <div className="flex items-center gap-2 pt-2 border-t border-border/40">
                            {guide.tourId && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1.5"
                                onClick={() => handleStartTour(guide.tourId!)}
                              >
                                <PlayCircle className="h-3.5 w-3.5 text-primary" />
                                Fazer Tour Deste Módulo
                              </Button>
                            )}
                            {guide.route && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs gap-1"
                                onClick={() => handleNavigateToRoute(guide.route!)}
                              >
                                Ir para Tela
                                <ArrowRight className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                )}
              </ScrollArea>
            </TabsContent>

            {/* ABA: FAQ */}
            <TabsContent value="faq" className="h-full m-0">
              <ScrollArea className="h-[460px] pr-3">
                {filteredFaqs.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    Nenhuma dúvida encontrada para "{searchQuery}".
                  </div>
                ) : (
                  <Accordion type="multiple" className="space-y-2.5">
                    {filteredFaqs.map((faq) => (
                      <AccordionItem
                        key={faq.id}
                        value={faq.id}
                        className="rounded-lg border border-border/60 bg-card px-4"
                      >
                        <AccordionTrigger className="py-3 text-left hover:no-underline">
                          <span className="font-semibold text-xs sm:text-sm text-foreground pr-2">
                            {faq.question}
                          </span>
                        </AccordionTrigger>
                        <AccordionContent className="pt-1 pb-4 text-xs text-muted-foreground leading-relaxed">
                          {faq.answer}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                )}
              </ScrollArea>
            </TabsContent>

            {/* ABA: ATALHOS */}
            <TabsContent value="atalhos" className="h-full m-0">
              <ScrollArea className="h-[460px] pr-3">
                <div className="space-y-4">
                  <p className="text-xs text-muted-foreground">
                    Utilize os atalhos de teclado para agilizar sua navegação e atendimento.
                  </p>

                  <div className="rounded-lg border border-border/60 divide-y divide-border/40 bg-card overflow-hidden">
                    {SHORTCUTS.map((s, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-4 p-3.5 hover:bg-muted/20 transition-colors"
                      >
                        <div className="space-y-0.5">
                          <span className="text-sm font-medium text-foreground">
                            {s.description}
                          </span>
                          <span className="block text-[11px] text-muted-foreground">
                            Contexto: {s.context}
                          </span>
                        </div>

                        <div className="flex shrink-0 items-center gap-1.5">
                          {s.keys.map((k) => (
                            <Tecla key={k}>{k}</Tecla>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
