import React from 'react';
import {
  ArrowRightLeft,
  Bell,
  BellRing,
  CheckCheck,
  CheckCircle2,
  UserPlus,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { formatDayTime } from '@/lib/formatters';
import { useNotificacoes } from '@/hooks/useNotificacoes';
import { useNotificationSettings } from '@/hooks/useNotificationSettings';
import { NotificacaoTipo } from '@/types/atendimento';

const tipoIcon: Record<NotificacaoTipo, React.ReactNode> = {
  atribuicao: <UserPlus className="h-4 w-4 text-primary" />,
  transferencia: <ArrowRightLeft className="h-4 w-4 text-amber-600 dark:text-amber-500" />,
  encerramento: <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-500" />,
};

const NotificationsBell = () => {
  const { notificacoes, naoLidas, setupError, marcarLida, marcarTodasLidas } =
    useNotificacoes();
  const { soundEnabled, browserEnabled, toggleSound, toggleBrowserNotifications } =
    useNotificationSettings();

  if (setupError) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="relative"
          aria-label={
            naoLidas > 0
              ? `Notificações: ${naoLidas} não lida(s)`
              : 'Notificações'
          }
        >
          <Bell className="h-5 w-5" />
          {naoLidas > 0 && (
            <span className="absolute right-1 top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
              {naoLidas > 99 ? '99+' : naoLidas}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2">
          <p className="text-sm font-semibold">Notificações</p>
          <div className="flex items-center gap-1">
            {naoLidas > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-xs text-muted-foreground"
                onClick={() => marcarTodasLidas.mutate()}
                disabled={marcarTodasLidas.isPending}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Marcar todas como lidas
              </Button>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={toggleSound}
                  aria-label={
                    soundEnabled
                      ? 'Silenciar som das notificações'
                      : 'Ativar som das notificações'
                  }
                  aria-pressed={soundEnabled}
                >
                  {soundEnabled ? (
                    <Volume2 className="h-4 w-4" />
                  ) : (
                    <VolumeX className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {soundEnabled ? 'Som ativado — clique para silenciar' : 'Som silenciado — clique para ativar'}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
        <Separator />
        <ScrollArea className="max-h-96">
          {notificacoes.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              Nenhuma notificação por aqui.
            </p>
          ) : (
            <div className="divide-y">
              {notificacoes.map((notificacao) => (
                <button
                  key={notificacao.id}
                  type="button"
                  onClick={() => {
                    if (!notificacao.lida) marcarLida.mutate(notificacao.id);
                  }}
                  className={cn(
                    'flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-accent',
                    !notificacao.lida && 'bg-primary/5'
                  )}
                >
                  <span className="mt-0.5 shrink-0" aria-hidden="true">
                    {tipoIcon[notificacao.tipo] ?? <Bell className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        'block truncate text-sm',
                        !notificacao.lida && 'font-medium'
                      )}
                    >
                      {notificacao.titulo}
                    </span>
                    {notificacao.descricao && (
                      <span className="block text-xs text-muted-foreground">
                        {notificacao.descricao}
                      </span>
                    )}
                    <span className="mt-0.5 block text-[11px] text-muted-foreground/70">
                      {formatDayTime(notificacao.createdAt)}
                    </span>
                  </span>
                  {!notificacao.lida && (
                    <span
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"
                      aria-label="Não lida"
                    />
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
        <Separator />
        <div className="flex items-center justify-between gap-2 px-3 py-2.5">
          <label
            htmlFor="browser-notifications-switch"
            className="flex min-w-0 cursor-pointer items-center gap-2"
          >
            <BellRing className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block text-sm">Notificações do navegador</span>
              <span className="block text-xs text-muted-foreground">
                Avisa novas mensagens com a aba em segundo plano
              </span>
            </span>
          </label>
          <Switch
            id="browser-notifications-switch"
            checked={browserEnabled}
            onCheckedChange={() => toggleBrowserNotifications()}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationsBell;
