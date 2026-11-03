import React from 'react';
import { 
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { GoogleCalendar } from '@/types/calendar';
import { 
  CalendarDays, Plus, Check, Trash2, RefreshCw, 
  CheckCircle2, AlertCircle, Info, Sparkles 
} from 'lucide-react';

interface ManageGoogleCalendarsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allCalendars: GoogleCalendar[];
  syncedCalendars: GoogleCalendar[];
  unsyncedCalendars: GoogleCalendar[];
  onEnableCalendar: (id: string) => void;
  onDisableCalendar: (id: string) => void;
  onSyncAll: () => void;
  isSyncing: boolean;
}

export function ManageGoogleCalendarsDialog({
  open,
  onOpenChange,
  allCalendars,
  syncedCalendars,
  unsyncedCalendars,
  onEnableCalendar,
  onDisableCalendar,
  onSyncAll,
  isSyncing
}: ManageGoogleCalendarsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col">
        <DialogHeader className="pb-2 border-b">
          <div className="flex items-center gap-2 text-primary">
            <CalendarDays className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">
              Google Calendar API
            </span>
          </div>
          <DialogTitle className="text-xl font-bold">
            Gerenciar Agendas do Google
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Escolha quais agendas da sua conta do Google serão sincronizadas e exibidas para os veterinários.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-3">
          <Tabs defaultValue={unsyncedCalendars.length > 0 ? "unsynced" : "synced"} className="w-full">
            <TabsList className="grid grid-cols-2 w-full mb-3 h-10">
              <TabsTrigger value="unsynced" className="text-xs gap-1.5 font-medium">
                <span>Disponíveis para Sincronizar</span>
                <Badge 
                  variant={unsyncedCalendars.length > 0 ? "default" : "secondary"}
                  className="ml-1 text-[10px] px-1.5 py-0 h-4 min-w-4"
                >
                  {unsyncedCalendars.length}
                </Badge>
              </TabsTrigger>

              <TabsTrigger value="synced" className="text-xs gap-1.5 font-medium">
                <span>Agendas Sincronizadas</span>
                <Badge 
                  variant="outline" 
                  className="ml-1 text-[10px] px-1.5 py-0 h-4 min-w-4 bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300"
                >
                  {syncedCalendars.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            {/* ABA 1: Agendas ainda não sincronizadas */}
            <TabsContent value="unsynced" className="space-y-3 mt-0">
              <div className="p-3 rounded-lg bg-blue-50/70 border border-blue-200/60 dark:bg-blue-950/20 dark:border-blue-900/40 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <p>
                  Estas são as agendas existentes na sua conta do Google que <strong>ainda não estão ativas</strong> no dashboard. Clique em sincronizar para adicioná-las.
                </p>
              </div>

              {unsyncedCalendars.length > 0 ? (
                <div className="divide-y divide-border border rounded-lg overflow-hidden bg-card">
                  {unsyncedCalendars.map((calendar) => (
                    <div 
                      key={calendar.id} 
                      className="p-3 flex items-center justify-between gap-3 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span 
                          className="h-3.5 w-3.5 rounded-full shrink-0 shadow-xs ring-1 ring-black/10" 
                          style={{ backgroundColor: calendar.backgroundColor || '#3b82f6' }}
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-foreground truncate">
                            {calendar.summary}
                          </p>
                          {calendar.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {calendar.description}
                            </p>
                          )}
                          <span className="text-[10px] font-mono text-muted-foreground truncate block">
                            ID: {calendar.id}
                          </span>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5 text-xs text-primary border-primary/30 hover:bg-primary/10 shrink-0"
                        onClick={() => onEnableCalendar(calendar.id)}
                        disabled={isSyncing}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Sincronizar
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center border rounded-lg bg-muted/20 space-y-2">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto" />
                  <p className="font-semibold text-sm text-foreground">
                    Todas as suas agendas do Google já estão sincronizadas!
                  </p>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                    Não há agendas pendentes na sua conta Google no momento.
                  </p>
                </div>
              )}
            </TabsContent>

            {/* ABA 2: Agendas ativas no sistema */}
            <TabsContent value="synced" className="space-y-3 mt-0">
              <div className="p-3 rounded-lg bg-emerald-50/70 border border-emerald-200/60 dark:bg-emerald-950/20 dark:border-emerald-900/40 text-xs text-emerald-900 dark:text-emerald-200 flex items-start gap-2">
                <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <p>
                  Agendas ativas no painel. Seus agendamentos são atualizados automaticamente diretamente da API do Google.
                </p>
              </div>

              {syncedCalendars.length > 0 ? (
                <div className="divide-y divide-border border rounded-lg overflow-hidden bg-card">
                  {syncedCalendars.map((calendar) => (
                    <div 
                      key={calendar.id} 
                      className="p-3 flex items-center justify-between gap-3 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span 
                          className="h-3.5 w-3.5 rounded-full shrink-0 shadow-xs ring-1 ring-black/10" 
                          style={{ backgroundColor: calendar.backgroundColor || '#3b82f6' }}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-sm text-foreground truncate">
                              {calendar.summary}
                            </p>
                            {calendar.primary && (
                              <Badge variant="secondary" className="text-[10px] px-1 py-0 font-normal">
                                Principal
                              </Badge>
                            )}
                          </div>
                          {calendar.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {calendar.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10 shrink-0"
                        onClick={() => onDisableCalendar(calendar.id)}
                        disabled={isSyncing}
                        title="Remover agenda da sincronização do sistema"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Pausar
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center border rounded-lg bg-muted/20 space-y-2">
                  <AlertCircle className="h-8 w-8 text-amber-500 mx-auto" />
                  <p className="font-semibold text-sm text-foreground">
                    Nenhuma agenda está ativa para sincronização.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Ative as agendas na aba "Disponíveis para Sincronizar" acima.
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="border-t pt-3 flex flex-row items-center justify-between sm:justify-between">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={onSyncAll}
            disabled={isSyncing}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            Sincronizar Agora
          </Button>

          <Button variant="default" size="sm" onClick={() => onOpenChange(false)}>
            Concluído
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
