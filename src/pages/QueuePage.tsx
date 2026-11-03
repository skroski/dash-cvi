import { FormEvent, useMemo, useState, useEffect } from 'react';
import {
  Plus,
  Tv,
  Hourglass,
  Stethoscope,
  Megaphone,
  Settings2,
  DoorOpen,
  RotateCcw,
  CheckCircle2,
  ChevronDown,
  Clock,
  UserCheck,
  AlertTriangle,
  Building2,
  Tag,
  Volume2,
  Pencil,
  Trash2,
  Check,
  X,
  Smartphone,
  Share2,
  ExternalLink,
  Printer,
  MessageCircle,
  Sliders,
  Smartphone as SmartphoneIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/shared/PageHeader';
import StatCard from '@/components/shared/StatCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import QueueClientSearch, { type SelectedClientData } from '@/components/queue/QueueClientSearch';
import QueueConfigDialog from '@/components/queue/QueueConfigDialog';
import { useFilaConfig } from '@/hooks/useFilaConfig';
import { imprimirCupom, ROTULO_PRIORIDADE_CUPOM } from '@/lib/filaCupom';
import { useQueue } from '@/hooks/useVetbotsModules';
import {
  QUEUE_ORIGIN_LABEL,
  QUEUE_PRIORITY_LABEL,
  QUEUE_STATUS_LABEL,
  type QueueItem,
  type QueuePriority,
  type QueueRoom,
  type QueueService,
} from '@/types/vetbotsModules';

const PRIORITY_ORDER: Record<QueuePriority, number> = {
  emergencia: 0,
  prioridade: 1,
  normal: 2,
};

function tempoDecorrido(dataIso: string): string {
  const diffMs = Date.now() - new Date(dataIso).getTime();
  const mins = Math.max(0, Math.floor(diffMs / 60000));
  if (mins < 1) return 'agora';
  if (mins === 1) return 'há 1 min';
  if (mins < 60) return `há ${mins} min`;
  const horas = Math.floor(mins / 60);
  return `há ${horas}h ${mins % 60}m`;
}

function traduzirErro(err: unknown): string {
  if (!err) return 'Ocorreu um erro inesperado.';
  const msg = typeof err === 'string' ? err : (err as { message?: string }).message || '';
  if (msg.includes('permission denied') || msg.includes('42501')) {
    return 'Permissão negada. É necessário perfil de gestor ou aplicar as permissões no banco de dados.';
  }
  if (msg.includes('unique constraint') || msg.includes('duplicate key')) {
    return 'Já existe um registro cadastrado com este nome.';
  }
  if (msg.includes('row-level security') || msg.includes('violates row-level security')) {
    return 'Ação bloqueada pelas regras de acesso.';
  }
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
    return 'Erro de conexão com o servidor. Verifique sua internet.';
  }
  if (msg.includes('Serviço indisponível')) {
    return 'Tipo de atendimento indisponível ou inativo.';
  }
  if (msg.includes('Nome do tutor é obrigatório')) {
    return 'O nome do tutor é obrigatório.';
  }
  if (msg.includes('Prioridade inválida')) {
    return 'Prioridade selecionada é inválida.';
  }
  return msg || 'Não foi possível completar a operação.';
}

export default function QueuePage() {
  const {
    services,
    rooms,
    items,
    createItem,
    act,
    createService,
    updateService,
    toggleService,
    deleteService,
    createRoom,
    updateRoom,
    toggleRoom,
    deleteRoom,
    changeRoom,
  } = useQueue();

  const { config: filaConfig, logoUrl } = useFilaConfig();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ajustesOpen, setAjustesOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'ativos' | 'historico'>('ativos');

  // Sala padrão selecionada pelo usuário para chamadas rápidas
  const [currentRoomId, setCurrentRoomId] = useState<string>(() => {
    return localStorage.getItem('cvi_queue_room_id') || '';
  });

  const allRooms = useMemo(() => rooms.data || [], [rooms.data]);
  const activeRooms = useMemo(() => allRooms.filter((r) => r.active), [allRooms]);

  const allServices = useMemo(() => services.data || [], [services.data]);
  const activeServices = useMemo(() => allServices.filter((s) => s.active), [allServices]);

  // Sincroniza sala padrão se a atual for desativada ou inexistente
  useEffect(() => {
    if (activeRooms.length > 0) {
      const exists = activeRooms.some((r) => r.id === currentRoomId);
      if (!exists) {
        const first = activeRooms[0].id;
        setCurrentRoomId(first);
        localStorage.setItem('cvi_queue_room_id', first);
      }
    }
  }, [activeRooms, currentRoomId]);

  const handleRoomChange = (roomId: string) => {
    setCurrentRoomId(roomId);
    localStorage.setItem('cvi_queue_room_id', roomId);
    const roomName = activeRooms.find((r) => r.id === roomId)?.name;
    if (roomName) {
      toast.info(`Sala padrão definida: ${roomName}`);
    }
  };

  const allItems = items.data || [];

  // Fila ativa (Aguardando, Chamado, Em atendimento)
  const activeItems = useMemo(
    () => allItems.filter((i) => ['aguardando', 'chamado', 'em_atendimento'].includes(i.status)),
    [allItems]
  );

  // Histórico (Finalizados, Ausentes, Cancelados)
  const historyItems = useMemo(
    () =>
      allItems
        .filter((i) => ['finalizado', 'ausente', 'cancelado'].includes(i.status))
        .sort(
          (a, b) =>
            new Date(b.finishedAt || b.arrivedAt).getTime() -
            new Date(a.finishedAt || a.arrivedAt).getTime()
        ),
    [allItems]
  );

  // Próximos da fila ordenados por prioridade e chegada
  const waitingItems = useMemo(
    () =>
      activeItems
        .filter((i) => i.status === 'aguardando')
        .sort(
          (a, b) =>
            PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
            new Date(a.arrivedAt).getTime() - new Date(b.arrivedAt).getTime()
        ),
    [activeItems]
  );

  const runAction = async (id: string, action: string, targetRoomId?: string | null) => {
    try {
      const roomToUse = targetRoomId || currentRoomId || activeRooms[0]?.id || null;
      await act.mutateAsync({ id, action, roomId: roomToUse });

      if (action === 'chamar') {
        const rName = allRooms.find((r) => r.id === roomToUse)?.name || 'consultório';
        toast.success(`Chamado para ${rName}! (Sinal enviado para a TV)`);
      } else if (action === 'iniciar') {
        toast.success('Atendimento iniciado');
      } else if (action === 'finalizar') {
        toast.success('Atendimento finalizado com sucesso');
      } else if (action === 'ausente') {
        toast.info('Paciente marcado como ausente');
      } else if (action === 'retornar') {
        toast.success('Paciente retornou para a fila de espera');
      } else if (action === 'cancelar') {
        toast.info('Atendimento cancelado');
      }
    } catch (err: unknown) {
      toast.error(traduzirErro(err));
    }
  };

  const handleTransferRoom = async (itemId: string, newRoomId: string) => {
    try {
      await changeRoom.mutateAsync({ itemId, roomId: newRoomId });
      const roomName = allRooms.find((r) => r.id === newRoomId)?.name || 'nova sala';
      toast.success(`Paciente transferido para ${roomName}`);
    } catch (err: unknown) {
      toast.error(traduzirErro(err));
    }
  };

  const currentRoomName = activeRooms.find((r) => r.id === currentRoomId)?.name;

  // Cupom térmico: usa as opções de Ajustes da fila (largura, rodapé, logotipo).
  const imprimirSenha = (item: QueueItem) => {
    imprimirCupom({
      clinica: filaConfig.nomeExibicao || 'Clínica Veterinária',
      logoUrl: filaConfig.cupomLogo ? logoUrl : null,
      rodape: filaConfig.cupomRodape,
      larguraMm: Number(filaConfig.cupomLarguraMm),
      senha: item.ticket,
      servico: allServices.find((s) => s.id === item.serviceId)?.name || 'Atendimento',
      tutor: item.tutorName,
      pet: item.petName,
      prioridade: ROTULO_PRIORIDADE_CUPOM[item.priority],
      chegadaEm: item.arrivedAt,
    });
  };

  const hoje = new Date().toDateString();
  const finalizadosHoje = historyItems.filter(
    (i) => i.status === 'finalizado' && i.finishedAt && new Date(i.finishedAt).toDateString() === hoje
  ).length;

  return (
    <PageContainer>
      <PageHeader
        title="Fila presencial"
        description="Organize a chegada, chamada nos consultórios e o fluxo de atendimento em tempo real."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Seletor rápido de Minha Sala */}
            {activeRooms.length === 0 ? (
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 text-xs text-amber-600 border-amber-300 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/20"
                onClick={() => setSettingsOpen(true)}
              >
                <DoorOpen className="h-4 w-4" />
                <span>Nenhuma sala (Cadastrar)</span>
              </Button>
            ) : (
              <div className="flex items-center">
                <Select
                  value={currentRoomId || activeRooms[0]?.id || ''}
                  onValueChange={handleRoomChange}
                >
                  <SelectTrigger className="h-9 w-auto min-w-[210px] max-w-[280px] bg-background text-xs font-medium shadow-sm gap-2">
                    <div className="flex items-center gap-1.5 truncate">
                      <DoorOpen className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="text-muted-foreground shrink-0 font-normal">Minha Sala:</span>
                      <SelectValue placeholder="Selecione a sala" />
                    </div>
                  </SelectTrigger>
                  <SelectContent align="start" className="min-w-[210px]">
                    {activeRooms.map((r) => (
                      <SelectItem key={r.id} value={r.id} className="text-xs font-medium cursor-pointer">
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button asChild variant="outline" size="sm">
              <Link to="/tv" target="_blank" rel="noopener noreferrer">
                <Tv className="mr-1.5 h-4 w-4" />
                Painel TV
              </Link>
            </Button>

            <Button asChild variant="outline" size="sm">
              <Link to="/totem" target="_blank" rel="noopener noreferrer" title="Abrir o totem de autoatendimento">
                <SmartphoneIcon className="mr-1.5 h-4 w-4" />
                Totem
              </Link>
            </Button>

            <Button variant="outline" size="sm" onClick={() => setAjustesOpen(true)} title="Aparência, TV, cupom, WhatsApp e totem">
              <Sliders className="mr-1.5 h-4 w-4" />
              Ajustes
            </Button>

            {currentRoomId && (
              <div className="flex items-center gap-1">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs text-emerald-700 dark:text-emerald-300 border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20"
                >
                  <Link
                    to={`/chamar?sala=${currentRoomId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Abrir chamador do consultório no celular ou desktop"
                  >
                    <Smartphone className="h-4 w-4" />
                    <span>Chamador da Sala</span>
                  </Link>
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    const url = `${window.location.origin}/chamar?sala=${currentRoomId}`;
                    navigator.clipboard.writeText(url);
                    toast.success(`Link da sala "${currentRoomName}" copiado!`, {
                      description: 'Envie para o WhatsApp do veterinário chamar os pacientes.',
                    });
                  }}
                  title="Copiar link desta sala para WhatsApp do veterinário"
                >
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>
            )}

            <QueueSettingsDialog
              open={settingsOpen}
              onOpenChange={setSettingsOpen}
              services={allServices}
              rooms={allRooms}
              onCreateService={async (v) => {
                await createService.mutateAsync(v);
              }}
              onUpdateService={async (v) => {
                await updateService.mutateAsync(v);
              }}
              onToggleService={async (id, active) => {
                await toggleService.mutateAsync({ id, active });
              }}
              onDeleteService={async (id) => {
                await deleteService.mutateAsync(id);
              }}
              onCreateRoom={async (v) => {
                await createRoom.mutateAsync(v);
              }}
              onUpdateRoom={async (v) => {
                await updateRoom.mutateAsync(v);
              }}
              onToggleRoom={async (id, active) => {
                await toggleRoom.mutateAsync({ id, active });
              }}
              onDeleteRoom={async (id) => {
                await deleteRoom.mutateAsync(id);
              }}
            />

            <NewQueueItem
              services={activeServices}
              whatsappAtivo={filaConfig.whatsappAtivo}
              onOpenSettings={() => setSettingsOpen(true)}
              onCreate={async ({ imprimir, ...dados }) => {
                try {
                  const item = await createItem.mutateAsync(dados);
                  toast.success(
                    item.phone && filaConfig.whatsappAtivo
                      ? `Senha ${item.ticket} gerada. O tutor será avisado pelo WhatsApp.`
                      : `Senha ${item.ticket} gerada com sucesso!`
                  );
                  if (imprimir) imprimirSenha(item);
                } catch (err: unknown) {
                  toast.error(traduzirErro(err));
                }
              }}
            />

            <QueueConfigDialog open={ajustesOpen} onOpenChange={setAjustesOpen} />
          </div>
        }
      />

      {/* Cards de Métricas */}
      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <StatCard
          title="Aguardando"
          value={waitingItems.length}
          icon={<Hourglass />}
          tone="warning"
        />
        <StatCard
          title="Chamados"
          value={activeItems.filter((i) => i.status === 'chamado').length}
          icon={<Megaphone />}
        />
        <StatCard
          title="Em atendimento"
          value={activeItems.filter((i) => i.status === 'em_atendimento').length}
          icon={<Stethoscope />}
          tone="success"
        />
        <StatCard
          title="Finalizados hoje"
          value={finalizadosHoje}
          icon={<CheckCircle2 />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_.7fr]">
        {/* Painel Principal com Abas */}
        <Card className="shadow-sm">
          <div className="border-b px-4 pt-3">
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as 'ativos' | 'historico')}
            >
              <div className="flex items-center justify-between">
                <TabsList className="grid w-64 grid-cols-2">
                  <TabsTrigger value="ativos" className="text-xs">
                    Fila Ativa ({activeItems.length})
                  </TabsTrigger>
                  <TabsTrigger value="historico" className="text-xs">
                    Histórico ({historyItems.length})
                  </TabsTrigger>
                </TabsList>

                {activeTab === 'ativos' && activeRooms.length === 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-amber-600 hover:text-amber-700 dark:text-amber-400"
                    onClick={() => setSettingsOpen(true)}
                  >
                    <AlertTriangle className="mr-1 h-3.5 w-3.5" />
                    Nenhuma sala cadastrada
                  </Button>
                )}
              </div>
            </Tabs>
          </div>

          <CardContent className="p-0">
            {activeTab === 'ativos' ? (
              <div className="divide-y">
                {activeItems.length === 0 ? (
                  <div className="p-12 text-center">
                    <Hourglass className="mx-auto h-8 w-8 text-muted-foreground/50" />
                    <p className="mt-2 text-sm font-medium">Fila vazia no momento</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Clique em &quot;Adicionar à fila&quot; para gerar a senha de um paciente.
                    </p>
                  </div>
                ) : (
                  activeItems.map((item) => (
                    <QueueItemRow
                      key={item.id}
                      item={item}
                      services={allServices}
                      allRooms={allRooms}
                      activeRooms={activeRooms}
                      currentRoomId={currentRoomId}
                      currentRoomName={currentRoomName}
                      onAction={runAction}
                      onTransferRoom={handleTransferRoom}
                      onPrint={imprimirSenha}
                    />
                  ))
                )}
              </div>
            ) : (
              <div className="divide-y">
                {historyItems.length === 0 ? (
                  <div className="p-12 text-center">
                    <CheckCircle2 className="mx-auto h-8 w-8 text-muted-foreground/50" />
                    <p className="mt-2 text-sm font-medium">Nenhum histórico hoje</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Atendimentos finalizados ou ausentes aparecerão aqui.
                    </p>
                  </div>
                ) : (
                  historyItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-3 p-4 opacity-80 transition hover:opacity-100"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-base font-bold text-muted-foreground">
                          {item.ticket}
                        </span>
                        <div>
                          <p className="text-sm font-medium">{item.petName || item.tutorName}</p>
                          <p className="text-xs text-muted-foreground">
                            Tutor: {item.tutorName}
                            {item.veterinarianName && ` · Vet: ${item.veterinarianName}`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {QUEUE_STATUS_LABEL[item.status]}
                        </Badge>
                        {item.status === 'ausente' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                            onClick={() => runAction(item.id, 'retornar')}
                          >
                            <RotateCcw className="mr-1 h-3.5 w-3.5" />
                            Retornar à fila
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Próximos da Fila */}
        <Card className="shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Próximos Chamados</h3>
              <Badge variant="secondary" className="text-xs">
                {waitingItems.length} aguardando
              </Badge>
            </div>

            <div className="mt-4 space-y-3">
              {waitingItems.slice(0, 6).map((item, idx) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border bg-muted/30 p-2.5 transition hover:bg-muted/60"
                >
                  <div className="flex items-center gap-3">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold">{item.ticket}</span>
                        <span className="text-xs font-medium">
                          {item.petName || item.tutorName}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {tempoDecorrido(item.arrivedAt)}
                      </p>
                    </div>
                  </div>

                  <Badge
                    variant={item.priority === 'emergencia' ? 'destructive' : 'outline'}
                    className="text-[10px]"
                  >
                    {QUEUE_PRIORITY_LABEL[item.priority]}
                  </Badge>
                </div>
              ))}

              {waitingItems.length === 0 && (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  Nenhum paciente aguardando no momento.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}

// Linha de cada paciente com ações contextuais e troca de sala
function QueueItemRow({
  item,
  services,
  allRooms,
  activeRooms,
  currentRoomId,
  currentRoomName,
  onAction,
  onTransferRoom,
  onPrint,
}: {
  item: QueueItem;
  services: QueueService[];
  allRooms: QueueRoom[];
  activeRooms: QueueRoom[];
  currentRoomId: string;
  currentRoomName?: string;
  onAction: (id: string, action: string, roomId?: string | null) => Promise<void>;
  onTransferRoom: (itemId: string, newRoomId: string) => Promise<void>;
  onPrint: (item: QueueItem) => void;
}) {
  const service = services.find((s) => s.id === item.serviceId);
  const room = allRooms.find((r) => r.id === item.roomId);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-4 transition hover:bg-muted/20">
      {/* Informações do Paciente */}
      <div className="flex min-w-[200px] flex-1 items-center gap-3.5">
        <div className="flex flex-col items-center justify-center rounded-lg bg-primary/10 px-2.5 py-1.5 font-mono text-base font-bold text-primary">
          {item.ticket}
        </div>

        <div>
          <div className="flex items-center gap-2">
            <b className="text-sm font-semibold">{item.petName || item.tutorName}</b>
            <Badge
              variant={item.priority === 'emergencia' ? 'destructive' : 'secondary'}
              className="text-[10px]"
            >
              {QUEUE_PRIORITY_LABEL[item.priority]}
            </Badge>
            {service && (
              <Badge variant="outline" className="text-[10px]">
                {service.name || service.nome}
              </Badge>
            )}
            {item.origin && item.origin !== 'balcao' && (
              <Badge variant="outline" className="border-sky-300 text-[10px] text-sky-700 dark:text-sky-300">
                {QUEUE_ORIGIN_LABEL[item.origin]}
              </Badge>
            )}
          </div>

          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Tutor: {item.tutorName}</span>
            {item.veterinarianName && <span>· Vet: {item.veterinarianName}</span>}
            {item.phone && (
              <a
                href={`https://wa.me/${item.phone}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-emerald-700 hover:underline dark:text-emerald-400"
                title={
                  item.notices && Object.keys(item.notices).length > 0
                    ? `Avisos por WhatsApp enviados: ${Object.keys(item.notices).join(', ')}`
                    : 'Abrir conversa no WhatsApp'
                }
              >
                <MessageCircle className="h-3 w-3" />
                {item.phone.replace(/^55(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3')}
                {item.notices && Object.keys(item.notices).length > 0 && <Check className="h-3 w-3" />}
              </a>
            )}
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {tempoDecorrido(item.arrivedAt)}
            </span>

            {/* Sala com opção rápida de transferir */}
            {['chamado', 'em_atendimento'].includes(item.status) && (
              <div className="flex items-center">
                {activeRooms.length > 1 ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300"
                        title="Clique para transferir para outra sala"
                      >
                        <DoorOpen className="h-3 w-3" />
                        {room ? room.name : 'Sem sala definida'}
                        <ChevronDown className="h-2.5 w-2.5 opacity-60" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuLabel className="text-xs">
                        Transferir para sala:
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {activeRooms.map((r) => (
                        <DropdownMenuItem
                          key={r.id}
                          onClick={() => onTransferRoom(item.id, r.id)}
                          className="text-xs font-medium"
                        >
                          <DoorOpen className="mr-2 h-3.5 w-3.5 text-emerald-600" />
                          {r.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : room ? (
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    · {room.name}
                  </span>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Ações da Fila */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-muted-foreground"
          onClick={() => onPrint(item)}
          title="Imprimir cupom da senha"
          aria-label={`Imprimir cupom da senha ${item.ticket}`}
        >
          <Printer className="h-4 w-4" />
        </Button>

        {/* Status: Aguardando */}
        {item.status === 'aguardando' && (
          <div className="flex items-center gap-1">
            {activeRooms.length > 1 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" className="h-8 gap-1">
                    <Megaphone className="h-3.5 w-3.5" />
                    Chamar
                    <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel className="text-xs">Chamar para:</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {activeRooms.map((r) => (
                    <DropdownMenuItem
                      key={r.id}
                      onClick={() => onAction(item.id, 'chamar', r.id)}
                      className="text-xs font-medium"
                    >
                      <DoorOpen className="mr-2 h-3.5 w-3.5 text-emerald-600" />
                      {r.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                size="sm"
                className="h-8 gap-1"
                onClick={() => onAction(item.id, 'chamar', currentRoomId || activeRooms[0]?.id)}
              >
                <Megaphone className="h-3.5 w-3.5" />
                Chamar {currentRoomName ? `(${currentRoomName})` : ''}
              </Button>
            )}

            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs text-muted-foreground hover:text-destructive"
              onClick={() => onAction(item.id, 'cancelar')}
            >
              Cancelar
            </Button>
          </div>
        )}

        {/* Status: Chamado */}
        {item.status === 'chamado' && (
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1 text-xs"
              onClick={() => onAction(item.id, 'chamar', item.roomId || currentRoomId)}
              title="Tocar sinal sonoro novamente na TV"
            >
              <Volume2 className="h-3.5 w-3.5 text-emerald-600" />
              Rechamar
            </Button>

            <Button
              size="sm"
              className="h-8 gap-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => onAction(item.id, 'iniciar')}
            >
              <UserCheck className="h-3.5 w-3.5" />
              Iniciar
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs text-muted-foreground hover:text-amber-600"
              onClick={() => onAction(item.id, 'ausente')}
            >
              Ausente
            </Button>
          </div>
        )}

        {/* Status: Em Atendimento */}
        {item.status === 'em_atendimento' && (
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              className="h-8 gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => onAction(item.id, 'finalizar')}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Finalizar
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs text-muted-foreground hover:text-amber-600"
              onClick={() => onAction(item.id, 'ausente')}
            >
              Ausente
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// Modal de Configuração da Fila com Edição de Salas e Tipos de Atendimento
function QueueSettingsDialog({
  open,
  onOpenChange,
  services,
  rooms,
  onCreateService,
  onUpdateService,
  onToggleService,
  onDeleteService,
  onCreateRoom,
  onUpdateRoom,
  onToggleRoom,
  onDeleteRoom,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  services: QueueService[];
  rooms: QueueRoom[];
  onCreateService: (v: { name: string; prefix: string; order?: number }) => Promise<void>;
  onUpdateService: (v: { id: string; name: string; prefix: string; order?: number }) => Promise<void>;
  onToggleService: (id: string, active: boolean) => Promise<void>;
  onDeleteService: (id: string) => Promise<void>;
  onCreateRoom: (v: { name: string }) => Promise<void>;
  onUpdateRoom: (v: { id: string; name: string }) => Promise<void>;
  onToggleRoom: (id: string, active: boolean) => Promise<void>;
  onDeleteRoom: (id: string) => Promise<void>;
}) {
  // Estado para nova sala
  const [newRoomName, setNewRoomName] = useState('');
  const [isSavingRoom, setIsSavingRoom] = useState(false);

  // Estado para edição de sala
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editingRoomName, setEditingRoomName] = useState('');

  // Estado para novo serviço
  const [newServiceName, setNewServiceName] = useState('');
  const [newServicePrefix, setNewServicePrefix] = useState('');
  const [isSavingService, setIsSavingService] = useState(false);

  // Estado para edição de serviço
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editingServiceName, setEditingServiceName] = useState('');
  const [editingServicePrefix, setEditingServicePrefix] = useState('');
  const [editingServiceOrder, setEditingServiceOrder] = useState<number>(0);

  const handleAddRoom = async (e: FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) {
      toast.error('Informe o nome da sala/consultório.');
      return;
    }
    try {
      setIsSavingRoom(true);
      await onCreateRoom({ name: newRoomName.trim() });
      toast.success(`Sala "${newRoomName}" adicionada com sucesso!`);
      setNewRoomName('');
    } catch (err: unknown) {
      toast.error(traduzirErro(err));
    } finally {
      setIsSavingRoom(false);
    }
  };

  const handleSaveEditRoom = async (id: string) => {
    if (!editingRoomName.trim()) {
      toast.error('O nome da sala não pode ficar vazio.');
      return;
    }
    try {
      await onUpdateRoom({ id, name: editingRoomName.trim() });
      toast.success('Sala atualizada com sucesso!');
      setEditingRoomId(null);
      setEditingRoomName('');
    } catch (err: unknown) {
      toast.error(traduzirErro(err));
    }
  };

  const handleDeleteRoomItem = async (r: QueueRoom) => {
    if (!window.confirm(`Deseja realmente excluir ou desativar a sala "${r.name}"?`)) {
      return;
    }
    try {
      await onDeleteRoom(r.id);
      toast.success(`Sala "${r.name}" removida com sucesso!`);
    } catch (err: unknown) {
      toast.error(traduzirErro(err));
    }
  };

  const handleAddService = async (e: FormEvent) => {
    e.preventDefault();
    if (!newServiceName.trim() || !newServicePrefix.trim()) {
      toast.error('Informe o nome e o prefixo da senha.');
      return;
    }
    try {
      setIsSavingService(true);
      await onCreateService({
        name: newServiceName.trim(),
        prefix: newServicePrefix.trim().toUpperCase(),
        order: services.length + 1,
      });
      toast.success(`Tipo de atendimento "${newServiceName}" cadastrado com sucesso!`);
      setNewServiceName('');
      setNewServicePrefix('');
    } catch (err: unknown) {
      toast.error(traduzirErro(err));
    } finally {
      setIsSavingService(false);
    }
  };

  const handleSaveEditService = async (id: string) => {
    if (!editingServiceName.trim() || !editingServicePrefix.trim()) {
      toast.error('Nome e prefixo são obrigatórios.');
      return;
    }
    try {
      await onUpdateService({
        id,
        name: editingServiceName.trim(),
        prefix: editingServicePrefix.trim().toUpperCase(),
        order: editingServiceOrder,
      });
      toast.success('Tipo de atendimento atualizado com sucesso!');
      setEditingServiceId(null);
    } catch (err: unknown) {
      toast.error(traduzirErro(err));
    }
  };

  const handleDeleteServiceItem = async (s: QueueService) => {
    const label = s.name || s.nome || 'Atendimento';
    if (!window.confirm(`Deseja realmente remover o tipo de atendimento "${label}"?`)) {
      return;
    }
    try {
      await onDeleteService(s.id);
      toast.success(`Tipo "${label}" removido com sucesso!`);
    } catch (err: unknown) {
      toast.error(traduzirErro(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="mr-1.5 h-4 w-4" />
          Configurar Fila
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Configurações da Fila
          </DialogTitle>
          <DialogDescription>
            Cadastre, edite ou alterne salas/consultórios e tipos de atendimento.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="salas" className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="salas" className="gap-2">
              <DoorOpen className="h-4 w-4" />
              Salas / Consultórios ({rooms.length})
            </TabsTrigger>
            <TabsTrigger value="servicos" className="gap-2">
              <Tag className="h-4 w-4" />
              Tipos de Atendimento ({services.length})
            </TabsTrigger>
          </TabsList>

          {/* ABA SALAS */}
          <TabsContent value="salas" className="space-y-4 pt-3">
            <form onSubmit={handleAddRoom} className="flex gap-2">
              <Input
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="Nome da nova sala (ex: Consultório 03, Sala de Vacinas...)"
                className="h-9 text-sm"
              />
              <Button type="submit" size="sm" className="shrink-0" disabled={isSavingRoom}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                {isSavingRoom ? 'Salvando...' : 'Adicionar Sala'}
              </Button>
            </form>

            <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border p-2">
              {rooms.length === 0 ? (
                <p className="p-4 text-center text-xs text-muted-foreground">
                  Nenhuma sala cadastrada. Adicione sua primeira sala acima.
                </p>
              ) : (
                rooms.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2 text-sm"
                  >
                    {editingRoomId === r.id ? (
                      <div className="flex flex-1 items-center gap-2 mr-2">
                        <Input
                          value={editingRoomName}
                          onChange={(e) => setEditingRoomName(e.target.value)}
                          className="h-8 text-xs font-medium"
                          autoFocus
                        />
                        <Button
                          size="icon"
                          className="h-8 w-8 shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => handleSaveEditRoom(r.id)}
                          title="Salvar alterações"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 shrink-0"
                          onClick={() => setEditingRoomId(null)}
                          title="Cancelar edição"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <DoorOpen className="h-4 w-4 text-muted-foreground" />
                        <span
                          className={
                            r.active ? 'font-medium' : 'text-muted-foreground line-through'
                          }
                        >
                          {r.name}
                        </span>
                      </div>
                    )}

                    {editingRoomId !== r.id && (
                      <div className="flex items-center gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                          onClick={() => {
                            const url = `${window.location.origin}/chamar?sala=${r.id}`;
                            navigator.clipboard.writeText(url);
                            toast.success(`Link da sala "${r.name}" copiado!`, {
                              description: 'Envie para o WhatsApp ou celular do veterinário.',
                            });
                          }}
                          title="Copiar link do chamador para WhatsApp do veterinário"
                        >
                          <Share2 className="h-3.5 w-3.5" />
                        </Button>

                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          asChild
                          title="Abrir tela de chamada deste consultório"
                        >
                          <Link to={`/chamar?sala=${r.id}`} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </Button>

                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setEditingRoomId(r.id);
                            setEditingRoomName(r.name);
                          }}
                          title="Editar nome da sala"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>

                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteRoomItem(r)}
                          title="Remover sala"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>

                        <div className="flex items-center gap-1 pl-2 border-l">
                          <span className="text-[11px] text-muted-foreground">
                            {r.active ? 'Ativa' : 'Inativa'}
                          </span>
                          <Switch
                            checked={r.active}
                            onCheckedChange={async (checked) => {
                              try {
                                await onToggleRoom(r.id, checked);
                                toast.success(
                                  `Sala ${r.name} ${checked ? 'ativada' : 'desativada'}`
                                );
                              } catch (err: unknown) {
                                toast.error(traduzirErro(err));
                              }
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          {/* ABA TIPOS DE ATENDIMENTO */}
          <TabsContent value="servicos" className="space-y-4 pt-3">
            <form onSubmit={handleAddService} className="space-y-2">
              <div className="grid grid-cols-[1fr_120px] gap-2">
                <Input
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  placeholder="Nome do tipo (ex: Cirurgia, Consulta Geral...)"
                  className="h-9 text-sm"
                />
                <Input
                  value={newServicePrefix}
                  onChange={(e) => setNewServicePrefix(e.target.value)}
                  placeholder="Prefixo (ex: C)"
                  maxLength={3}
                  className="h-9 text-center text-sm uppercase font-mono"
                />
              </div>
              <Button
                type="submit"
                size="sm"
                className="w-full"
                disabled={isSavingService || !newServiceName.trim() || !newServicePrefix.trim()}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                {isSavingService ? 'Salvando...' : 'Adicionar Tipo de Atendimento'}
              </Button>
            </form>

            <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border p-2">
              {services.length === 0 ? (
                <p className="p-4 text-center text-xs text-muted-foreground">
                  Nenhum tipo cadastrado. Adicione o primeiro tipo acima.
                </p>
              ) : (
                services.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2 text-sm"
                  >
                    {editingServiceId === s.id ? (
                      <div className="flex flex-1 items-center gap-2 mr-2">
                        <Input
                          value={editingServiceName}
                          onChange={(e) => setEditingServiceName(e.target.value)}
                          placeholder="Nome"
                          className="h-8 text-xs font-medium"
                          autoFocus
                        />
                        <Input
                          value={editingServicePrefix}
                          onChange={(e) => setEditingServicePrefix(e.target.value)}
                          placeholder="Prefixo"
                          maxLength={3}
                          className="h-8 w-20 text-center text-xs uppercase font-mono"
                        />
                        <Button
                          size="icon"
                          className="h-8 w-8 shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => handleSaveEditService(s.id)}
                          title="Salvar alterações"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 shrink-0"
                          onClick={() => setEditingServiceId(null)}
                          title="Cancelar edição"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span
                          className={
                            s.active ? 'font-medium' : 'text-muted-foreground line-through'
                          }
                        >
                          {s.name || s.nome}
                        </span>
                        <Badge variant="outline" className="font-mono text-xs">
                          Senha {s.prefix || s.prefixo || 'A'}...
                        </Badge>
                      </div>
                    )}

                    {editingServiceId !== s.id && (
                      <div className="flex items-center gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setEditingServiceId(s.id);
                            setEditingServiceName(s.name || s.nome || '');
                            setEditingServicePrefix(s.prefix || s.prefixo || 'A');
                            setEditingServiceOrder(s.order || 0);
                          }}
                          title="Editar tipo de atendimento"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>

                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteServiceItem(s)}
                          title="Remover tipo de atendimento"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>

                        <div className="flex items-center gap-1 pl-2 border-l">
                          <span className="text-[11px] text-muted-foreground">
                            {s.active ? 'Ativo' : 'Inativo'}
                          </span>
                          <Switch
                            checked={s.active}
                            onCheckedChange={async (checked) => {
                              try {
                                await onToggleService(s.id, checked);
                                toast.success(
                                  `Serviço ${s.name || s.nome} ${checked ? 'ativado' : 'desativado'}`
                                );
                              } catch (err: unknown) {
                                toast.error(traduzirErro(err));
                              }
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// Modal de Adicionar à Fila (Gerar Senha)
const CHAVE_IMPRIMIR_BALCAO = 'fila_imprimir_balcao';

function lerImprimirBalcao(): boolean {
  try {
    return localStorage.getItem(CHAVE_IMPRIMIR_BALCAO) === 'true';
  } catch {
    return false;
  }
}

function NewQueueItem({
  services,
  whatsappAtivo,
  onOpenSettings,
  onCreate,
}: {
  services: QueueService[];
  whatsappAtivo: boolean;
  onOpenSettings: () => void;
  onCreate: (v: {
    serviceId: string;
    tutorName: string;
    petName: string;
    veterinarianName: string;
    priority: QueuePriority;
    clienteId?: number | null;
    petId?: string | null;
    phone?: string | null;
    imprimir: boolean;
  }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [service, setService] = useState('');
  const [tutor, setTutor] = useState('');
  const [pet, setPet] = useState('');
  const [vet, setVet] = useState('');
  const [phone, setPhone] = useState('');
  const [priority, setPriority] = useState<QueuePriority>('normal');
  const [submitting, setSubmitting] = useState(false);
  const [cliente, setCliente] = useState<SelectedClientData | null>(null);
  const [imprimir, setImprimir] = useState(lerImprimirBalcao);

  const escolherCliente = (c: SelectedClientData) => {
    setCliente(c);
    setTutor(c.tutorName);
    setPet(c.petName);
    // O telefone do cadastro costuma vir como JID (5541...@s.whatsapp.net): ficam só os dígitos.
    setPhone(c.phone ? c.phone.replace(/@.*$/, '').replace(/\D/g, '') : '');
  };

  const limparCliente = () => {
    setCliente(null);
    setTutor('');
    setPet('');
    setPhone('');
  };

  // Auto-seleciona primeiro serviço se houver
  useEffect(() => {
    if (services.length > 0 && !service) {
      setService(services[0].id);
    }
  }, [services, service]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!service || !tutor.trim()) {
      if (!service) toast.error('Selecione o tipo de atendimento.');
      return;
    }

    try {
      setSubmitting(true);
      try {
        localStorage.setItem(CHAVE_IMPRIMIR_BALCAO, String(imprimir));
      } catch {
        /* sem armazenamento: vale só nesta sessão */
      }
      await onCreate({
        serviceId: service,
        tutorName: tutor.trim(),
        petName: pet.trim(),
        veterinarianName: vet.trim(),
        priority,
        clienteId: cliente?.clienteId ?? null,
        petId: cliente?.petId ?? null,
        phone: phone.replace(/\D/g, '') || null,
        imprimir,
      });
      setOpen(false);
      setTutor('');
      setPet('');
      setVet('');
      setPhone('');
      setCliente(null);
      setPriority('normal');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          Adicionar à fila
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo Atendimento Presencial</DialogTitle>
          <DialogDescription>
            Gere a senha de atendimento para organizar a chamada do paciente.
          </DialogDescription>
        </DialogHeader>

        {services.length === 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
            <p className="font-semibold">Nenhum tipo de atendimento ativo encontrado</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Cadastre pelo menos um tipo de atendimento (ex: Consulta, Retorno, Vacinação) para gerar senhas.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => {
                setOpen(false);
                onOpenSettings();
              }}
            >
              <Tag className="mr-1.5 h-3.5 w-3.5" />
              Configurar Tipos de Atendimento
            </Button>
          </div>
        ) : (
          <form className="space-y-3" onSubmit={handleSubmit}>
            <div className="space-y-1">
              <Label className="text-xs">Tipo de atendimento *</Label>
              <Select value={service} onValueChange={setService}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {services.map((s) => {
                    const label = s.name || s.nome || 'Atendimento';
                    const prefix = s.prefix || s.prefixo || 'A';
                    return (
                      <SelectItem key={s.id} value={s.id}>
                        {label} (Senha {prefix}...)
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Buscar cliente cadastrado (opcional)</Label>
              <QueueClientSearch selectedClient={cliente} onSelectClient={escolherCliente} onClearSelection={limparCliente} />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Nome do tutor *</Label>
              <Input
                value={tutor}
                onChange={(e) => setTutor(e.target.value)}
                placeholder="Ex: Carlos Oliveira"
                required
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Nome do pet</Label>
              <Input
                value={pet}
                onChange={(e) => setPet(e.target.value)}
                placeholder="Ex: Pipoca"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">WhatsApp do tutor (opcional)</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(41) 99999-0000"
                inputMode="tel"
              />
              <p className="text-[11px] text-muted-foreground">
                {whatsappAtivo
                  ? 'Com o número, o tutor recebe os avisos da fila pelo WhatsApp (senha, sua vez está chegando e chamada).'
                  : 'Fica salvo na senha. Para avisar o tutor, ligue os avisos em Ajustes → WhatsApp.'}
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Veterinário responsável (opcional)</Label>
              <Input
                value={vet}
                onChange={(e) => setVet(e.target.value)}
                placeholder="Ex: Dra. Mariana"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Prioridade</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as QueuePriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="prioridade">Prioridade (Idosos/Filhotes)</SelectItem>
                  <SelectItem value="emergencia">Emergência</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={imprimir} onChange={(e) => setImprimir(e.target.checked)} className="h-4 w-4" />
              Imprimir o cupom da senha (lembra a escolha neste computador)
            </label>

            <Button className="w-full" disabled={submitting || !service}>
              {submitting ? 'Gerando senha...' : 'Gerar Senha e Adicionar'}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
