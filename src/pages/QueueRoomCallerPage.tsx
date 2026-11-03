import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import {
  DoorOpen,
  Megaphone,
  UserCheck,
  CheckCircle2,
  Volume2,
  Clock,
  ArrowRight,
  Share2,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Sparkles,
  AlertCircle,
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
  if (mins < 1) return 'agora mesmo';
  if (mins === 1) return 'há 1 min';
  if (mins < 60) return `há ${mins} min`;
  const horas = Math.floor(mins / 60);
  return `há ${horas}h ${mins % 60}m`;
}

export default function QueueRoomCallerPage() {
  const { roomId: routeRoomId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  // O ID da sala pode vir da rota (/chamar/:roomId), da query (?sala=...) ou do localStorage
  const effectiveRoomId =
    routeRoomId ||
    searchParams.get('sala') ||
    localStorage.getItem('cvi_caller_room_id') ||
    '';

  const [currentRoomId, setCurrentRoomId] = useState<string>(effectiveRoomId);
  const [queueData, setQueueData] = useState<RoomQueueData>({
    sala: null,
    atual: null,
    proximos: [],
    salas: [],
  });
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showWaitingList, setShowWaitingList] = useState(true);

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
      console.warn('Erro ao carregar dados do consultório:', err);
    } finally {
      setLoading(false);
    }
  }, [currentRoomId]);

  // Atualiza quando o ID da sala muda
  useEffect(() => {
    if (currentRoomId) {
      localStorage.setItem('cvi_caller_room_id', currentRoomId);
      // Mantém a query string sincronizada
      if (searchParams.get('sala') !== currentRoomId) {
        setSearchParams({ sala: currentRoomId }, { replace: true });
      }
    }
    fetchRoomData();
  }, [currentRoomId, fetchRoomData, searchParams, setSearchParams]);

  // Inscrição em tempo real via Realtime do Supabase
  useEffect(() => {
    const channel = db
      .channel('room-caller-realtime')
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
      toast.error('Selecione uma sala primeiro.');
      return;
    }

    try {
      setActing(true);
      if (navigator.vibrate) {
        navigator.vibrate([40, 50, 40]);
      }

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
        toast.success('Atendimento iniciado.');
      } else if (action === 'finalizar') {
        toast.success('Atendimento concluído com sucesso!');
      } else if (action === 'ausente') {
        toast.info('Paciente marcado como ausente.');
      }

      await fetchRoomData();
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('Nenhum paciente')) {
        toast.info('Nenhum paciente aguardando na fila no momento.');
      } else {
        toast.error('Não foi possível realizar a ação: ' + (err?.message || 'Erro inesperado'));
      }
    } finally {
      setActing(false);
    }
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/chamar?sala=${currentRoomId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Link do consultório copiado!', {
      description: 'Envie para o celular do veterinário ou adicione aos favoritos.',
    });
    setTimeout(() => setCopied(false), 2500);
  };

  const roomName = queueData.sala?.nome || 'Consultório';
  const currentPatient = queueData.atual;
  const waitingPatients = queueData.proximos || [];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex flex-col justify-between">
      {/* Topo / Barra do Consultório */}
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur px-4 py-3 shadow-sm">
        <div className="mx-auto max-w-lg flex items-center justify-between gap-2">
          {/* Identificação da Sala com seletor */}
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 gap-2 px-3 font-semibold text-xs border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20"
                >
                  <DoorOpen className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="truncate max-w-[150px] sm:max-w-[200px]">
                    {roomName}
                  </span>
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel className="text-xs">Trocar de Sala / Consultório</DropdownMenuLabel>
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
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Ao vivo
            </span>
          </div>

          {/* Ações do cabeçalho */}
          <div className="flex items-center gap-1.5">
            {currentRoomId && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={handleCopyLink}
                title="Copiar link deste consultório para o celular"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Share2 className="h-4 w-4" />
                )}
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={fetchRoomData}
              title="Atualizar fila"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="mx-auto w-full max-w-lg flex-1 p-4 space-y-4">
        {/* Caso o usuário ainda não tenha selecionado nenhuma sala */}
        {!currentRoomId ? (
          <Card className="border-dashed shadow-sm text-center p-6">
            <DoorOpen className="mx-auto h-12 w-12 text-emerald-600/70" />
            <h2 className="mt-3 text-lg font-bold">Selecione seu Consultório</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Escolha a sala em que você está atendendo hoje para começar a chamar pacientes pelo celular ou desktop.
            </p>

            <div className="mt-4 grid gap-2">
              {queueData.salas.length === 0 ? (
                <p className="text-xs text-amber-600 py-2">
                  Nenhuma sala cadastrada. Peça à recepção para cadastrar no painel da fila.
                </p>
              ) : (
                queueData.salas.map((s) => (
                  <Button
                    key={s.id}
                    variant="outline"
                    className="h-12 justify-start gap-3 text-sm font-semibold hover:border-emerald-500 hover:bg-emerald-500/10"
                    onClick={() => {
                      setCurrentRoomId(s.id);
                      toast.success(`Consultório ${s.nome} selecionado!`);
                    }}
                  >
                    <DoorOpen className="h-5 w-5 text-emerald-600" />
                    <span>{s.nome}</span>
                  </Button>
                ))
              )}
            </div>
          </Card>
        ) : (
          <>
            {/* CARD PRINCIPAL: PACIENTE ATUAL OU BOTÃO CHAMAR PRÓXIMO */}
            {currentPatient ? (
              <Card className="border-2 border-emerald-500/30 bg-gradient-to-b from-emerald-500/5 to-transparent shadow-md overflow-hidden">
                <div className="border-b bg-emerald-500/10 px-4 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    <Megaphone className="h-3.5 w-3.5" />
                    <span>
                      {currentPatient.status === 'chamado'
                        ? 'Paciente Chamado (Aguardando entrar)'
                        : 'Em Atendimento no Consultório'}
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {tempoDecorrido(
                      currentPatient.status === 'chamado'
                        ? currentPatient.calledAt
                        : currentPatient.startedAt
                    )}
                  </span>
                </div>

                <CardContent className="p-5 text-center">
                  {/* Senha Grande */}
                  <div className="font-mono text-6xl sm:text-7xl font-black tracking-tight text-primary drop-shadow-sm">
                    {currentPatient.ticket}
                  </div>

                  {/* Dados do Paciente */}
                  <div className="mt-2">
                    <h3 className="text-xl sm:text-2xl font-bold">
                      {currentPatient.petName || currentPatient.tutorName}
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                      Tutor: <b>{currentPatient.tutorName}</b>
                      {currentPatient.serviceName && ` · ${currentPatient.serviceName}`}
                    </p>
                  </div>

                  <div className="mt-2.5 flex justify-center gap-1.5">
                    <Badge
                      variant={
                        currentPatient.priority === 'emergencia'
                          ? 'destructive'
                          : currentPatient.priority === 'prioridade'
                          ? 'default'
                          : 'secondary'
                      }
                      className="text-xs"
                    >
                      {QUEUE_PRIORITY_LABEL[currentPatient.priority]}
                    </Badge>
                  </div>

                  {/* Ações do Paciente Atual */}
                  <div className="mt-6 grid gap-2">
                    {currentPatient.status === 'chamado' && (
                      <>
                        <Button
                          size="lg"
                          className="h-14 text-base font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md gap-2"
                          disabled={acting}
                          onClick={() => handleAction('iniciar', currentPatient.id)}
                        >
                          <UserCheck className="h-5 w-5" />
                          Iniciar Consulta
                        </Button>

                        <div className="grid grid-cols-2 gap-2 mt-1">
                          <Button
                            variant="outline"
                            className="h-11 text-xs gap-1.5 font-medium"
                            disabled={acting}
                            onClick={() => handleAction('chamar', currentPatient.id)}
                            title="Tocar sinal na TV novamente"
                          >
                            <Volume2 className="h-4 w-4 text-emerald-600" />
                            Rechamar na TV
                          </Button>

                          <Button
                            variant="ghost"
                            className="h-11 text-xs text-muted-foreground hover:text-amber-600 font-medium"
                            disabled={acting}
                            onClick={() => handleAction('ausente', currentPatient.id)}
                          >
                            Marcar Ausente
                          </Button>
                        </div>
                      </>
                    )}

                    {currentPatient.status === 'em_atendimento' && (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <Button
                            asChild
                            variant="outline"
                            className="h-11 text-xs font-bold border-primary/50 text-primary hover:bg-primary/5 gap-2"
                          >
                            <Link
                              to={`/prontuario?tutor=${encodeURIComponent(currentPatient.tutorName)}&pet=${encodeURIComponent(currentPatient.petName || 'Paciente')}${currentPatient.veterinarianName ? `&vet=${encodeURIComponent(currentPatient.veterinarianName)}` : ''}`}
                            >
                              <Sparkles className="h-4 w-4 text-primary" />
                              Prontuário com IA
                            </Link>
                          </Button>

                          <Button
                            asChild
                            variant="outline"
                            className="h-11 text-xs font-bold border-teal-500 text-teal-700 hover:bg-teal-50 gap-2"
                          >
                            <Link
                              to={`/receituario?tutor=${encodeURIComponent(currentPatient.tutorName)}&pet=${encodeURIComponent(currentPatient.petName || 'Paciente')}&fila=${encodeURIComponent(currentPatient.id)}${currentPatient.veterinarianName ? `&vet=${encodeURIComponent(currentPatient.veterinarianName)}` : ''}`}
                            >
                              <Sparkles className="h-4 w-4 text-teal-600" />
                              Receituário com IA
                            </Link>
                          </Button>
                        </div>

                        <Button
                          size="lg"
                          className="h-14 text-base font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md gap-2"
                          disabled={acting}
                          onClick={() => handleAction('finalizar', currentPatient.id)}
                        >
                          <CheckCircle2 className="h-5 w-5" />
                          Finalizar Atendimento
                        </Button>

                        <div className="flex items-center justify-between pt-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-muted-foreground hover:text-amber-600"
                            disabled={acting}
                            onClick={() => handleAction('ausente', currentPatient.id)}
                          >
                            Interromper / Ausente
                          </Button>

                          {waitingPatients.length > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs text-primary gap-1"
                              disabled={acting}
                              onClick={async () => {
                                await handleAction('finalizar', currentPatient.id);
                                await handleAction('chamar');
                              }}
                            >
                              Finalizar e Chamar Próximo
                              <ArrowRight className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              /* ESTADO: NENHUM PACIENTE NA SALA NO MOMENTO */
              <Card className="border shadow-md overflow-hidden">
                <CardContent className="p-6 text-center">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-inner">
                    <DoorOpen className="h-7 w-7" />
                  </div>

                  <h2 className="text-xl font-bold tracking-tight">
                    {roomName} Livre
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {waitingPatients.length > 0
                      ? `Existem ${waitingPatients.length} paciente(s) aguardando atendimento na recepção.`
                      : 'Nenhum paciente aguardando na recepção no momento.'}
                  </p>

                  <div className="mt-6">
                    <Button
                      size="lg"
                      className="w-full h-16 text-lg font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg transition-transform active:scale-[0.98] gap-2"
                      disabled={acting || waitingPatients.length === 0}
                      onClick={() => handleAction('chamar')}
                    >
                      <Megaphone className="h-6 w-6" />
                      Chamar Próximo Paciente
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* SEÇÃO: FILA DE ESPERA DA CLÍNICA */}
            <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
              <button
                className="w-full px-4 py-3 border-b flex items-center justify-between text-left hover:bg-muted/40 transition"
                onClick={() => setShowWaitingList((v) => !v)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Fila de Espera
                  </span>
                  <Badge variant="secondary" className="text-xs font-mono">
                    {waitingPatients.length}
                  </Badge>
                </div>

                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span>{showWaitingList ? 'Ocultar' : 'Ver lista'}</span>
                  {showWaitingList ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </div>
              </button>

              {showWaitingList && (
                <div className="divide-y max-h-72 overflow-y-auto">
                  {waitingPatients.length === 0 ? (
                    <div className="p-6 text-center text-xs text-muted-foreground">
                      Nenhum paciente na fila de espera no momento.
                    </div>
                  ) : (
                    waitingPatients.map((p, idx) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between gap-3 p-3 transition hover:bg-muted/30"
                      >
                        <div className="flex items-center gap-3">
                          <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                            {idx + 1}
                          </span>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-sm font-bold">
                                {p.ticket}
                              </span>
                              <span className="text-xs font-semibold truncate max-w-[130px] sm:max-w-[180px]">
                                {p.petName || p.tutorName}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              Tutor: {p.tutorName} · {tempoDecorrido(p.arrivedAt)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Badge
                            variant={p.priority === 'emergencia' ? 'destructive' : 'outline'}
                            className="text-[10px]"
                          >
                            {QUEUE_PRIORITY_LABEL[p.priority]}
                          </Badge>

                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
                            disabled={acting}
                            onClick={() => handleAction('chamar', p.id)}
                            title="Chamar este paciente para o seu consultório agora"
                          >
                            Chamar
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* Rodapé Simples */}
      <footer className="border-t bg-background/50 px-4 py-2.5 text-center text-[11px] text-muted-foreground">
        <div className="mx-auto max-w-lg flex items-center justify-between">
          <Link
            to="/tv"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline flex items-center gap-1 text-emerald-600 dark:text-emerald-400"
          >
            Abrir Painel TV
          </Link>
          <Link to="/queue" className="hover:underline">
            Painel Geral da Fila
          </Link>
        </div>
      </footer>
    </div>
  );
}
