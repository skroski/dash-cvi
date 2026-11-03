import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  DoorOpen,
  Megaphone,
  UserCheck,
  CheckCircle2,
  Volume2,
  Clock,
  RefreshCw,
  Maximize2,
  ChevronDown,
  Users,
  ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { QUEUE_PRIORITY_LABEL } from '@/types/vetbotsModules';

type RoomInfo = {
  id: string;
  nome: string;
  ativa: boolean;
};

type QueuePatient = {
  id: string;
  ticket: string;
  tutorName: string;
  petName: string | null;
  veterinarianName: string | null;
  priority: 'normal' | 'prioridade' | 'emergencia';
  status: 'aguardando' | 'chamado' | 'em_atendimento' | 'finalizado' | 'ausente' | 'cancelado';
  arrivedAt: string;
  calledAt?: string | null;
  startedAt?: string | null;
  roomId?: string | null;
  roomName?: string | null;
  serviceName?: string | null;
};

type RoomQueueData = {
  sala: RoomInfo | null;
  atual: QueuePatient | null;
  proximos: QueuePatient[];
  salas: RoomInfo[];
};

const db = supabase as never as {
  rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: any; error: any }>;
  channel: typeof supabase.channel;
  removeChannel: typeof supabase.removeChannel;
};

function tempoDecorrido(dataIso?: string | null): string {
  if (!dataIso) return '';
  const diffMs = Date.now() - new Date(dataIso).getTime();
  const mins = Math.max(0, Math.floor(diffMs / 60000));
  if (mins < 1) return 'agora';
  if (mins === 1) return 'há 1 min';
  if (mins < 60) return `há ${mins} min`;
  const horas = Math.floor(mins / 60);
  return `há ${horas}h ${mins % 60}m`;
}

function tocarSomChamada() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // AudioContext pode ser bloqueado sem gesto de usuário
  }
}

interface RoomCallerWidgetProps {
  className?: string;
}

export const RoomCallerWidget: React.FC<RoomCallerWidgetProps> = ({ className = '' }) => {
  const [currentRoomId, setCurrentRoomId] = useState<string>(() => {
    return localStorage.getItem('cvi_caller_room_id') || '';
  });

  const [queueData, setQueueData] = useState<RoomQueueData>({
    sala: null,
    atual: null,
    proximos: [],
    salas: [],
  });
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [showQueueList, setShowQueueList] = useState(false);

  // Carrega os dados da sala e da fila
  const fetchRoomData = useCallback(async () => {
    try {
      const { data, error } = await db.rpc('sala_obter_fila', {
        p_sala_id: currentRoomId || null,
      });
      if (error) throw error;
      if (data) {
        setQueueData(data);
        // Se a sala atual não tiver ID mas a API retornou salas e temos apenas 1 sala ativa, auto-seleciona
        if (!currentRoomId && data.salas && data.salas.length === 1) {
          const onlyRoom = data.salas[0].id;
          setCurrentRoomId(onlyRoom);
          localStorage.setItem('cvi_caller_room_id', onlyRoom);
        }
      }
    } catch (err) {
      console.warn('Erro ao carregar fila do consultório:', err);
    } finally {
      setLoading(false);
    }
  }, [currentRoomId]);

  useEffect(() => {
    if (currentRoomId) {
      localStorage.setItem('cvi_caller_room_id', currentRoomId);
    }
    fetchRoomData();
  }, [currentRoomId, fetchRoomData]);

  // Inscrição em tempo real via Realtime do Supabase
  useEffect(() => {
    const channel = db
      .channel('schedule-caller-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fila_itens' }, fetchRoomData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fila_chamadas' }, fetchRoomData)
      .subscribe();

    const interval = window.setInterval(fetchRoomData, 10000);

    return () => {
      db.removeChannel(channel);
      window.clearInterval(interval);
    };
  }, [fetchRoomData]);

  // Executa uma ação (Chamar, Iniciar, Finalizar, Ausente)
  const handleAction = async (action: string, itemId?: string) => {
    if (!currentRoomId) {
      toast.error('Selecione um consultório primeiro.');
      return;
    }

    try {
      setActing(true);
      if (navigator.vibrate) {
        navigator.vibrate([40, 50, 40]);
      }
      tocarSomChamada();

      const { data, error } = await db.rpc('sala_chamar_fila', {
        p_sala_id: currentRoomId,
        p_item_id: itemId || null,
        p_acao: action,
      });

      if (error) throw error;

      if (action === 'chamar') {
        toast.success(`Senha ${data?.senha || ''} chamada para o consultório!`, {
          description: 'Sinal sonoro enviado para o painel da TV.',
        });
      } else if (action === 'iniciar') {
        toast.success('Consulta iniciada no consultório.');
      } else if (action === 'finalizar') {
        toast.success('Atendimento concluído com sucesso!');
      } else if (action === 'ausente') {
        toast.info('Paciente marcado como ausente.');
      }

      await fetchRoomData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err || '');
      if (msg.includes('Nenhum paciente')) {
        toast.info('Nenhum paciente aguardando na fila no momento.');
      } else {
        toast.error('Não foi possível realizar a ação: ' + (msg || 'Erro inesperado'));
      }
    } finally {
      setActing(false);
    }
  };

  const roomName = queueData.sala?.nome || (currentRoomId ? 'Consultório' : 'Selecionar Consultório');
  const currentPatient = queueData.atual;
  const waitingPatients = queueData.proximos || [];
  const nextPatient = waitingPatients[0] || null;

  return (
    <Card className={`border shadow-sm overflow-hidden mb-6 bg-card transition-all ${className}`}>
      {/* Barra Superior do Widget */}
      <div className="bg-muted/40 border-b px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {/* Seletor de Sala */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-2 px-3 font-semibold text-xs border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20"
              >
                <DoorOpen className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span className="truncate max-w-[140px] sm:max-w-[200px]">{roomName}</span>
                <ChevronDown className="h-3 w-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel className="text-xs">Consultório Atual</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {queueData.salas.map((s) => (
                <DropdownMenuItem
                  key={s.id}
                  onClick={() => {
                    setCurrentRoomId(s.id);
                    toast.info(`Consultório alterado para: ${s.nome}`);
                  }}
                  className="text-xs font-medium cursor-pointer"
                >
                  <DoorOpen className="mr-2 h-4 w-4 text-emerald-600" />
                  <span>{s.nome}</span>
                  {s.id === currentRoomId && (
                    <span className="ml-auto text-[10px] text-emerald-600 font-semibold">Ativo</span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Fila ao vivo
          </span>

          <Badge variant="secondary" className="text-[11px] font-medium hidden sm:inline-flex">
            {waitingPatients.length === 0
              ? 'Nenhum na espera'
              : `${waitingPatients.length} aguardando`}
          </Badge>
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          {waitingPatients.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground"
              onClick={() => setShowQueueList((prev) => !prev)}
            >
              <Users className="h-3.5 w-3.5" />
              <span>Ver Fila ({waitingPatients.length})</span>
              {showQueueList ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={fetchRoomData}
            title="Atualizar fila agora"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>

          <Link
            to={currentRoomId ? `/chamar?sala=${currentRoomId}` : '/chamar'}
            title="Abrir tela cheia do consultório"
          >
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Conteúdo Principal do Chamador */}
      <CardContent className="p-4">
        {!currentRoomId ? (
          <div className="text-center py-4">
            <DoorOpen className="mx-auto h-8 w-8 text-muted-foreground/60 mb-2" />
            <p className="text-sm font-semibold">Selecione o seu Consultório</p>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-md mx-auto">
              Escolha a sala em que você está atendendo para habilitar a chamada de pacientes na TV e gerenciar a fila.
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {queueData.salas.map((s) => (
                <Button
                  key={s.id}
                  size="sm"
                  variant="outline"
                  className="text-xs font-semibold gap-1.5"
                  onClick={() => setCurrentRoomId(s.id)}
                >
                  <DoorOpen className="h-3.5 w-3.5 text-emerald-600" />
                  {s.nome}
                </Button>
              ))}
            </div>
          </div>
        ) : currentPatient ? (
          /* Paciente Atual Chamado ou em Atendimento */
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
            <div className="flex items-center gap-4 text-center md:text-left">
              <div className="font-mono text-3xl sm:text-4xl font-black text-emerald-600 dark:text-emerald-400 bg-card px-3 py-1.5 rounded-lg border shadow-xs">
                {currentPatient.ticket}
              </div>
              <div>
                <div className="flex items-center gap-2 justify-center md:justify-start">
                  <h4 className="text-base sm:text-lg font-bold">
                    {currentPatient.petName || currentPatient.tutorName}
                  </h4>
                  <Badge
                    variant={currentPatient.status === 'chamado' ? 'default' : 'secondary'}
                    className={`text-[10px] ${
                      currentPatient.status === 'chamado'
                        ? 'bg-amber-500 hover:bg-amber-600 text-white'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                  >
                    {currentPatient.status === 'chamado' ? 'Aguardando Entrar' : 'Em Atendimento'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Tutor: <b>{currentPatient.tutorName}</b>
                  {currentPatient.serviceName && ` · ${currentPatient.serviceName}`}
                  <span className="ml-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground/80">
                    <Clock className="h-3 w-3" />
                    {tempoDecorrido(
                      currentPatient.status === 'chamado'
                        ? currentPatient.calledAt
                        : currentPatient.startedAt
                    )}
                  </span>
                </p>
              </div>
            </div>

            {/* Ações do Paciente Atual */}
            <div className="flex flex-wrap items-center gap-2 justify-center md:justify-end w-full md:w-auto">
              {currentPatient.status === 'chamado' ? (
                <>
                  <Button
                    size="sm"
                    className="h-9 px-4 font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs gap-1.5"
                    disabled={acting}
                    onClick={() => handleAction('iniciar', currentPatient.id)}
                  >
                    <UserCheck className="h-4 w-4" />
                    Iniciar Consulta
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 px-3 text-xs gap-1 font-medium"
                    disabled={acting}
                    onClick={() => handleAction('chamar', currentPatient.id)}
                    title="Tocar aviso sonoro novamente na TV"
                  >
                    <Volume2 className="h-3.5 w-3.5 text-emerald-600" />
                    Rechamar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 px-2 text-xs text-muted-foreground hover:text-amber-600"
                    disabled={acting}
                    onClick={() => handleAction('ausente', currentPatient.id)}
                  >
                    Ausente
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="sm"
                    className="h-9 px-4 font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-xs gap-1.5"
                    disabled={acting}
                    onClick={() => handleAction('finalizar', currentPatient.id)}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Finalizar Consulta
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 px-2 text-xs text-muted-foreground hover:text-amber-600"
                    disabled={acting}
                    onClick={() => handleAction('ausente', currentPatient.id)}
                  >
                    Ausente
                  </Button>
                </>
              )}
            </div>
          </div>
        ) : (
          /* Consultório Livre: Opção de Chamar Próximo Paciente */
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-lg border border-dashed bg-muted/20">
            <div className="flex items-center gap-3 text-center sm:text-left">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-500/10 text-emerald-600">
                <Megaphone className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  {nextPatient ? 'Paciente aguardando na recepção' : 'Consultório livre'}
                </p>
                {nextPatient ? (
                  <p className="text-sm font-bold">
                    Próximo: <span className="font-mono text-primary font-black">{nextPatient.ticket}</span> · {nextPatient.petName || nextPatient.tutorName}
                    <span className="text-xs font-normal text-muted-foreground ml-1">
                      (Tutor: {nextPatient.tutorName})
                    </span>
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Nenhum paciente aguardando na fila presencial no momento.
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {nextPatient && (
                <Badge
                  variant={nextPatient.priority === 'emergencia' ? 'destructive' : 'outline'}
                  className="text-[10px]"
                >
                  {QUEUE_PRIORITY_LABEL[nextPatient.priority]}
                </Badge>
              )}
              <Button
                size="sm"
                className="h-9 px-4 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs gap-1.5"
                disabled={acting || !nextPatient}
                onClick={() => handleAction('chamar')}
              >
                <Megaphone className="h-4 w-4" />
                Chamar Próximo Paciente
              </Button>
            </div>
          </div>
        )}

        {/* Lista expansível de espera rápida */}
        {showQueueList && waitingPatients.length > 0 && (
          <div className="mt-3 border rounded-md divide-y max-h-48 overflow-y-auto bg-card">
            {waitingPatients.map((p, idx) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-2.5 text-xs hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                    {idx + 1}
                  </span>
                  <span className="font-mono font-bold text-xs">{p.ticket}</span>
                  <span className="font-semibold">{p.petName || p.tutorName}</span>
                  <span className="text-muted-foreground text-[11px]">({p.tutorName})</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={p.priority === 'emergencia' ? 'destructive' : 'outline'}
                    className="text-[9px] h-4 px-1.5"
                  >
                    {QUEUE_PRIORITY_LABEL[p.priority]}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-[11px] text-emerald-700 dark:text-emerald-300"
                    disabled={acting}
                    onClick={() => handleAction('chamar', p.id)}
                  >
                    Chamar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
