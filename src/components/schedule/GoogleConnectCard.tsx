import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CalendarDays, RefreshCw, LoaderCircle, Settings, LogOut, CheckCircle2, Layers, Database, Globe
} from 'lucide-react';
import { format, isToday, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface GoogleConnectCardProps {
  isConnected: boolean;
  hasGoogleAuth?: boolean;
  isCentralSync?: boolean;
  lastSync?: Date | null;
  syncedByEmail?: string | null;
  isLoading: boolean;
  isSyncing: boolean;
  syncedCount: number;
  unsyncedCount: number;
  onConnect: () => void;
  onDisconnect: () => void;
  onSync: () => void;
  onOpenManageDialog: () => void;
}

export function GoogleConnectCard({
  isConnected,
  hasGoogleAuth = false,
  isCentralSync = false,
  lastSync,
  syncedByEmail,
  isLoading,
  isSyncing,
  syncedCount,
  unsyncedCount,
  onConnect,
  onDisconnect,
  onSync,
  onOpenManageDialog
}: GoogleConnectCardProps) {
  // Formatação amigável da última sincronização
  const formattedSyncTime = React.useMemo(() => {
    if (!lastSync || !isValid(new Date(lastSync))) return null;
    const d = new Date(lastSync);
    if (isToday(d)) {
      return `Hoje às ${format(d, 'HH:mm')}`;
    }
    return format(d, "dd/MM 'às' HH:mm", { locale: ptBR });
  }, [lastSync]);

  // Caso 1: Nenhuma agenda sincronizada e nenhum token (Primeiro acesso)
  if (!isConnected) {
    return (
      <div 
        className="rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 p-6 shadow-sm mb-6 flex flex-col md:flex-row items-center justify-between gap-4"
        data-tour="schedule-connect"
      >
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-2xl bg-white dark:bg-zinc-900 shadow-xs border border-primary/20 shrink-0">
            {/* Google Calendar Logo SVG */}
            <svg className="h-8 w-8" viewBox="0 0 48 48" fill="none">
              <path fill="#4285F4" d="M38 44H10C6.686 44 4 41.314 4 38V10C4 6.686 6.686 4 10 4H38C41.314 4 44 6.686 44 10V38C41.314 4 44 6.686 44 10Z"/>
              <path fill="#FFF" d="M35 15H13V35H35V15Z"/>
              <path fill="#EA4335" d="M35 15H13V21H35V15Z"/>
              <path fill="#4285F4" d="M22 28H18V32H22V28Z"/>
              <path fill="#FBBC05" d="M30 28H26V32H30V28Z"/>
              <path fill="#34A853" d="M30 23H18V26H30V23Z"/>
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">
              Conecte a conta do Google Agenda da Clínica
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-xl leading-relaxed">
              Sincronize as agendas da clínica uma única vez para disponibilizar os agendamentos no banco central para todos os veterinários e consultórios em tempo real.
            </p>
          </div>
        </div>

        <Button
          onClick={onConnect}
          disabled={isLoading}
          className="gap-2 shrink-0 h-10 px-5 shadow-sm font-semibold"
        >
          {isLoading ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <svg className="h-4 w-4 mr-1" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.9C6.2 7.4 8.9 5 12 5z"/>
              <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"/>
              <path fill="#FBBC05" d="M5.3 14.7c-.2-.7-.4-1.5-.4-2.3 0-.8.2-1.6.4-2.3L1.6 7.2C.6 9.2 0 11.5 0 14s.6 4.8 1.6 6.8l3.7-6.1z"/>
              <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.4-6.7-5.3L1.6 16c1.9 3.8 5.8 7 10.4 7z"/>
            </svg>
          )}
          <span>{isLoading ? 'Conectando...' : 'Conectar Google Agenda'}</span>
        </Button>
      </div>
    );
  }

  // Caso 2: Visualização via Base Central (Sincronizada para Veterinários / Outros Dispositivos)
  if (isCentralSync) {
    return (
      <div 
        className="rounded-xl border bg-card p-3 shadow-xs mb-6 flex flex-wrap items-center justify-between gap-3 text-xs"
        data-tour="schedule-connect"
      >
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="font-semibold text-foreground flex items-center gap-1.5">
            <Database className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            Base Central Sincronizada
          </span>
          <Badge variant="outline" className="text-[11px] bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">
            {syncedCount} agenda(s) ativas
          </Badge>
          {formattedSyncTime && (
            <span className="text-muted-foreground text-[11px] hidden sm:inline">
              · Atualizado {formattedSyncTime}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Gerenciar Agendas */}
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs text-foreground font-medium"
            onClick={onOpenManageDialog}
            title="Ver e gerenciar agendas ativas no painel"
          >
            <Layers className="h-3.5 w-3.5 text-primary" />
            <span>Agendas ({syncedCount})</span>
          </Button>

          {/* Atualizar Dados da Base Central */}
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={onSync}
            disabled={isSyncing}
            title="Atualizar agendamentos da base central"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin text-primary' : ''}`} />
            <span className="hidden sm:inline">Recarregar Base</span>
          </Button>

          {/* Botão de destaque para conectar conta Google e puxar agendamentos */}
          <Button
            variant="default"
            size="sm"
            className="h-8 gap-1.5 text-xs font-semibold shadow-xs"
            onClick={onConnect}
            disabled={isLoading || isSyncing}
            title="Conectar sua conta Google para sincronizar os dados mais recentes de todas as agendas"
          >
            <Globe className="h-3.5 w-3.5" />
            <span>Sincronizar com Google</span>
          </Button>
        </div>
      </div>
    );
  }

  // Caso 3: Conexão Direta Ativa neste Navegador (Sincronizador Principal)
  return (
    <div 
      className="rounded-xl border bg-card p-3 shadow-xs mb-6 flex flex-wrap items-center justify-between gap-3 text-xs"
      data-tour="schedule-connect"
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="flex h-2.5 w-2.5 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
        </span>
        <span className="font-semibold text-foreground flex items-center gap-1.5">
          API Google Conectada (Sincronizador)
        </span>
        <Badge variant="outline" className="text-[11px] bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">
          {syncedCount} agenda(s) ativas
        </Badge>
        {unsyncedCount > 0 && (
          <Badge variant="secondary" className="text-[11px] bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
            {unsyncedCount} nova(s) disponível(is)
          </Badge>
        )}
        {formattedSyncTime && (
          <span className="text-muted-foreground text-[11px] hidden lg:inline">
            · Atualizado {formattedSyncTime}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Botão para ver e gerenciar agendas sincronizadas e não sincronizadas */}
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs text-foreground font-medium"
          onClick={onOpenManageDialog}
          title="Ver e gerenciar agendas sincronizadas e não sincronizadas"
        >
          <Layers className="h-3.5 w-3.5 text-primary" />
          <span>Gerenciar Agendas ({syncedCount + unsyncedCount})</span>
          {unsyncedCount > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-primary text-primary-foreground">
              +{unsyncedCount}
            </span>
          )}
        </Button>

        <Button
          variant="default"
          size="sm"
          className="h-8 gap-1.5 text-xs font-semibold"
          onClick={onSync}
          disabled={isSyncing}
          title="Buscar agendamentos recentes do Google e salvar na base central"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Google'}</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive"
          onClick={onDisconnect}
          title="Desconectar conta do Google deste dispositivo"
        >
          <LogOut className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
