import { useState, useEffect } from 'react';
import {
  Calendar,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Radio,
  ExternalLink,
  Loader2,
  Copy,
  CalendarSync,
  Clock,
  ShieldCheck,
  Plus,
  Trash2,
  CalendarPlus,
  Info,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useReminderGoogleCalendar } from '@/hooks/useReminderGoogleCalendar';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface GoogleCalendarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GoogleCalendarDialog({ open, onOpenChange }: GoogleCalendarDialogProps) {
  const gcal = useReminderGoogleCalendar(open);
  const [novoNome, setNovoNome] = useState('');
  const [novoId, setNovoId] = useState('');
  const [mostrarFormulario, setMostrarFormulario] = useState(false);

  const agendas = gcal.config?.agendas || (gcal.config?.calendarId ? [{ id: gcal.config.calendarId, nome: 'Agenda Principal' }] : []);

  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    toast.success('E-mail copiado! Compartilhe sua agenda com este endereço no Google Calendar.');
  };

  const handleAdicionarAgenda = () => {
    if (!novoId.trim()) {
      toast.error('Informe o ID ou e-mail da agenda do Google');
      return;
    }
    const idLimpo = novoId.trim();
    if (agendas.some((a) => a.id.toLowerCase() === idLimpo.toLowerCase())) {
      toast.error('Esta agenda já está cadastrada');
      return;
    }
    const nomeLimpo = novoNome.trim() || `Agenda ${agendas.length + 1}`;
    const novasAgendas = [...agendas, { id: idLimpo, nome: nomeLimpo }];

    gcal.updateConfig.mutate(
      { agendas: novasAgendas },
      {
        onSuccess: () => {
          setNovoNome('');
          setNovoId('');
          setMostrarFormulario(false);
          toast.success(`Agenda "${nomeLimpo}" adicionada! Lembre-se de compartilhá-la no Google Calendar.`);
        },
      }
    );
  };

  const handleRemoverAgenda = (idParaRemover: string, nomeAgenda: string) => {
    if (agendas.length <= 1) {
      toast.error('É necessário manter pelo menos uma agenda configurada');
      return;
    }
    const novasAgendas = agendas.filter((a) => a.id !== idParaRemover);
    gcal.updateConfig.mutate(
      { agendas: novasAgendas },
      {
        onSuccess: () => toast.success(`Agenda "${nomeAgenda}" removida`),
      }
    );
  };

  const isCanalAtivo = Boolean(gcal.config?.ativo && gcal.config?.canalId);
  const diasRestantes = gcal.config?.diasRestantes ?? 0;
  const diag = gcal.diagnostics;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Integração Google Calendar</DialogTitle>
              <DialogDescription>
                Push Notifications nativas (events.watch), sincronização bidirecional e botões do WhatsApp.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Status do Canal Push (events.watch) */}
          <div
            className={cn(
              'rounded-lg border p-3.5 transition-colors',
              isCanalAtivo
                ? 'border-emerald-500/30 bg-emerald-500/5'
                : 'border-amber-500/30 bg-amber-500/5'
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <Radio
                  className={cn(
                    'mt-0.5 h-4 w-4',
                    isCanalAtivo ? 'text-emerald-500 animate-pulse' : 'text-amber-500'
                  )}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">
                      {isCanalAtivo ? 'Push Webhook Ativo (Tempo Real)' : 'Webhook Desconectado'}
                    </p>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[11px] font-normal',
                        isCanalAtivo
                          ? 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                          : 'border-amber-500/30 text-amber-600 dark:text-amber-400'
                      )}
                    >
                      {isCanalAtivo ? `Expira em ${diasRestantes} dias` : 'Inativo'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    {isCanalAtivo
                      ? 'Alterações feitas no Google Calendar (arrastar horário, reagendar ou excluir evento) são sincronizadas instantaneamente sem polling.'
                      : 'O Google não está notificando este painel. Ative o canal abaixo para ligar a escuta de alterações.'}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => gcal.refetchDiagnostics()}
                disabled={gcal.diagnosticsLoading}
                title="Atualizar diagnóstico"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', gcal.diagnosticsLoading && 'animate-spin')} />
              </Button>
            </div>

            {/* Ações de sincronização manual sob demanda */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/50">
              <span className="text-[11px] text-muted-foreground">
                Modo sob demanda: sincroniza as 2 agendas ao clicar no botão e preserva qualquer edição feita no painel.
              </span>

              <div className="flex flex-wrap gap-2 ml-auto">
                <Button
                  size="sm"
                  variant="default"
                  className="h-8 gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => gcal.puxarDoGoogle.mutate()}
                  disabled={gcal.puxarDoGoogle.isPending}
                  title="Puxar eventos novos das duas agendas do Google Calendar para o painel"
                >
                  {gcal.puxarDoGoogle.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  Sincronizar as 2 Agendas Agora
                </Button>
              </div>
            </div>
          </div>

          {/* Gerenciador de Agendas do Google Calendar */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-semibold">Agendas Conectadas do Google Calendar</Label>
                <p className="text-[11px] text-muted-foreground">
                  O painel sincroniza automaticamente os eventos de todas as agendas cadastradas abaixo.
                </p>
              </div>
              {!mostrarFormulario && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1 border-blue-500/40 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
                  onClick={() => setMostrarFormulario(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar Agenda
                </Button>
              )}
            </div>

            {/* Lista de Agendas */}
            <div className="space-y-2">
              {agendas.map((ag, idx) => {
                const statusAgenda = diag?.calendarsDiagnostic?.find(
                  (d) => d.id.toLowerCase() === ag.id.toLowerCase()
                );
                return (
                  <div
                    key={ag.id}
                    className="flex items-start justify-between gap-2 rounded-lg border bg-card p-2.5 transition-colors hover:border-blue-500/30"
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        <Calendar className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-semibold text-foreground truncate">{ag.nome}</span>
                          {idx === 0 && (
                            <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
                              Principal
                            </Badge>
                          )}
                          {statusAgenda?.ok === true && (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 h-4 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 gap-1"
                            >
                              <CheckCircle2 className="h-2.5 w-2.5" />
                              Conectada ({statusAgenda.summary || ag.nome})
                            </Badge>
                          )}
                          {statusAgenda && statusAgenda.ok === false && (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 h-4 border-amber-500/40 text-amber-600 dark:text-amber-400 gap-1"
                            >
                              <AlertTriangle className="h-2.5 w-2.5" />
                              Falta compartilhar com o e-mail abaixo
                            </Badge>
                          )}
                        </div>
                        <p className="font-mono text-[11px] text-muted-foreground select-all break-all mt-0.5">
                          {ag.id}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          navigator.clipboard.writeText(ag.id);
                          toast.success('ID da agenda copiado!');
                        }}
                        title="Copiar ID da Agenda"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      {agendas.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleRemoverAgenda(ag.id, ag.nome)}
                          disabled={gcal.updateConfig.isPending}
                          title={`Remover ${ag.nome}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Formulário para Adicionar Nova Agenda */}
            {mostrarFormulario && (
              <div className="rounded-lg border-2 border-dashed border-blue-500/40 bg-blue-500/5 p-3 space-y-2.5 animate-in fade-in duration-200">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
                  <CalendarPlus className="h-4 w-4" />
                  <span>Conectar Nova Agenda do Google</span>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="novo-nome-agenda" className="text-[11px]">
                    Nome amigável da agenda
                  </Label>
                  <Input
                    id="novo-nome-agenda"
                    placeholder="Ex: Raio-X &amp; Exames, Dra. Mariana, Ultrassom..."
                    value={novoNome}
                    onChange={(e) => setNovoNome(e.target.value)}
                    className="h-8 text-xs bg-background"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="novo-id-agenda" className="text-[11px]">
                    ID da Agenda do Google (endereço do calendário)
                  </Label>
                  <Input
                    id="novo-id-agenda"
                    placeholder="Ex: hash@group.calendar.google.com ou clinica@gmail.com"
                    value={novoId}
                    onChange={(e) => setNovoId(e.target.value)}
                    className="h-8 font-mono text-xs bg-background"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Onde achar: Google Calendar &gt; Configurações da agenda &gt; <em>Integrar agenda</em> &gt; <em>Código da agenda</em>.
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      setMostrarFormulario(false);
                      setNovoNome('');
                      setNovoId('');
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1"
                    onClick={handleAdicionarAgenda}
                    disabled={gcal.updateConfig.isPending || !novoId.trim()}
                  >
                    {gcal.updateConfig.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Plus className="h-3 w-3" />
                    )}
                    Salvar Agenda
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* E-mail da Service Account para Compartilhamento */}
          <div className="rounded-md border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <ShieldCheck className="h-4 w-4 text-blue-500" />
              <span>Passo Essencial: Compartilhar AMBAS as Agendas no Google Calendar</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              No Google Calendar, abra as <em>Configurações</em> de cada uma das duas agendas &gt; <em>Compartilhar com pessoas específicas</em> e adicione o e-mail da Service Account com permissão para <strong>"Fazer alterações nos eventos"</strong> (ou "Ver todos os detalhes dos eventos"):
            </p>
            {diag?.serviceAccountEmail ? (
              <div className="flex items-center justify-between gap-2 rounded bg-background p-2 border font-mono text-xs">
                <span className="truncate select-all">{diag.serviceAccountEmail}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => handleCopyEmail(diag.serviceAccountEmail as string)}
                  title="Copiar e-mail"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <p className="text-xs text-destructive">
                GOOGLE_SERVICE_ACCOUNT_KEY não configurada nos secrets do Supabase.
              </p>
            )}
          </div>

          {/* Mapeamento Visual de Cores */}
          <div className="rounded-md border p-3">
            <p className="text-xs font-semibold mb-2 text-foreground">Mapeamento Visual no Google Calendar</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-emerald-500 shrink-0" />
                <span>Confirmado (Verde / Basil)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-rose-500 shrink-0" />
                <span>Cancelado (Vermelho / Tomato)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-amber-500 shrink-0" />
                <span>Remarcar (Laranja / Tangerine)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-sky-500 shrink-0" />
                <span>Agendado (Azul / Peacock)</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default GoogleCalendarDialog;

