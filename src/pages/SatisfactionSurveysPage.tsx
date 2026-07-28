import { useDeferredValue, useMemo, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Copy,
  Database,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  MessageSquareText,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Star,
  TrendingUp,
  UserCheck,
  Users,
  Upload,
  Webhook,
  Workflow,
  XCircle,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts';
import { toast } from 'sonner';
import PageContainer from '@/components/layout/PageContainer';
import EmptyState from '@/components/shared/EmptyState';
import PageHeader from '@/components/shared/PageHeader';
import StatCard from '@/components/shared/StatCard';
import SatisfactionConfigurationDialog from '@/components/satisfaction/SatisfactionConfigurationDialog';
import SpreadsheetImportDialog from '@/components/shared/SpreadsheetImportDialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ENV_DEFAULTS } from '@/config/env';
import { useSatisfactionSurveys } from '@/hooks/useSatisfactionSurveys';
import { cn } from '@/lib/utils';
import { parseSatisfactionSpreadsheet } from '@/lib/operationalSpreadsheets';
import { exportSpreadsheet } from '@/lib/spreadsheet';
import {
  SatisfactionConfiguration,
  SatisfactionConfigurationInput,
  SatisfactionDelivery,
  SatisfactionDeliveryStatus,
} from '@/types/satisfaction';
import { SatisfactionSpreadsheetImportRow } from '@/types/spreadsheet';

const STATUS_META: Record<
  SatisfactionDeliveryStatus,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  pendente: {
    label: 'Pendente',
    icon: Clock3,
    className: 'border-warning/20 bg-warning/10 text-warning',
  },
  enviado: {
    label: 'Enviado',
    icon: Send,
    className: 'border-success/20 bg-success/10 text-success',
  },
  cadastrado: {
    label: 'Cadastrado',
    icon: UserCheck,
    className: 'border-primary/20 bg-primary/10 text-primary',
  },
  falha: {
    label: 'Falha',
    icon: XCircle,
    className: 'border-destructive/20 bg-destructive/10 text-destructive',
  },
};

const trendChartConfig = {
  respostas: {
    label: 'Respostas',
    color: 'hsl(var(--primary))',
  },
} satisfies ChartConfig;

const ratingChartConfig = {
  quantidade: {
    label: 'Respostas',
    color: 'hsl(var(--success))',
  },
} satisfies ChartConfig;

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00Z`));
}

function formatDateTime(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, '');
  const local = digits.startsWith('55') ? digits.slice(2) : digits;
  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }
  if (local.length === 10) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  return digits || value;
}

const StatusBadge = ({ status }: { status: SatisfactionDeliveryStatus }) => {
  const meta = STATUS_META[status];
  const Icon = meta.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        meta.className
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {meta.label}
    </span>
  );
};

function configurationIsReady(configuration: SatisfactionConfiguration) {
  return Boolean(
    configuration.googleFormId &&
      configuration.googleFormUrl &&
      configuration.googleTokenEntryId &&
      configuration.messageTemplate.includes('{{link_pesquisa}}')
  );
}

const SatisfactionSurveysPage = () => {
  const {
    configurations,
    deliveries,
    responses,
    loading,
    setupError,
    saveConfiguration,
    toggleConfiguration,
    updateDeliveryStatus,
    importDeliveries,
    getAllSurveyData,
    refresh,
  } = useSatisfactionSurveys();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [editingConfiguration, setEditingConfiguration] =
    useState<SatisfactionConfiguration | null>(null);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [statusFilter, setStatusFilter] = useState<
    'todos' | SatisfactionDeliveryStatus
  >('todos');

  const responseByDelivery = useMemo(
    () => new Map(responses.map((response) => [response.deliveryId, response])),
    [responses]
  );

  const filteredDeliveries = useMemo(() => {
    const term = deferredSearch.trim().toLocaleLowerCase('pt-BR');
    return deliveries.filter((delivery) => {
      if (statusFilter !== 'todos' && delivery.status !== statusFilter) return false;
      if (!term) return true;
      return [
        delivery.ownerName,
        delivery.phone,
        delivery.email,
        delivery.petName,
        delivery.configurationName,
      ]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase('pt-BR').includes(term));
    });
  }, [deferredSearch, deliveries, statusFilter]);

  const stats = useMemo(() => {
    const sent = deliveries.filter((delivery) => delivery.status === 'enviado').length;
    const registered = deliveries.filter(
      (delivery) => delivery.status === 'cadastrado'
    ).length;
    const delivered = sent + registered;
    const responseRate = delivered > 0 ? (registered / delivered) * 100 : 0;
    const ratings = responses
      .map((response) => response.rating)
      .filter((rating): rating is number => rating !== null);
    const averageRating = ratings.length
      ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
      : null;
    return { sent, registered, delivered, responseRate, averageRating };
  }, [deliveries, responses]);

  const results = useMemo(() => {
    const ratingDistribution = [1, 2, 3, 4, 5].map((rating) => ({
      nota: `${rating} ${rating === 1 ? 'estrela' : 'estrelas'}`,
      quantidade: responses.filter(
        (response) => Math.round(response.rating ?? 0) === rating
      ).length,
    }));

    const responseDates = new Map<string, number>();
    responses.forEach((response) => {
      const key = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(response.submittedAt));
      responseDates.set(key, (responseDates.get(key) ?? 0) + 1);
    });
    const trend = Array.from(responseDates.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([date, quantidade]) => ({
        data: new Intl.DateTimeFormat('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          timeZone: 'UTC',
        }).format(new Date(`${date}T12:00:00Z`)),
        respostas: quantidade,
      }));

    const npsValues = responses
      .map((response) => response.nps)
      .filter((nps): nps is number => nps !== null);
    const promoters = npsValues.filter((value) => value >= 9).length;
    const detractors = npsValues.filter((value) => value <= 6).length;
    const nps =
      npsValues.length > 0
        ? Math.round(((promoters - detractors) / npsValues.length) * 100)
        : null;

    return { ratingDistribution, trend, nps, npsCount: npsValues.length };
  }, [responses]);

  const webhookUrl = `${ENV_DEFAULTS.SUPABASE_URL}/functions/v1/google-forms-satisfaction`;

  const openNewConfiguration = () => {
    setEditingConfiguration(null);
    setDialogOpen(true);
  };

  const openEditConfiguration = (configuration: SatisfactionConfiguration) => {
    setEditingConfiguration(configuration);
    setDialogOpen(true);
  };

  const handleSave = (input: SatisfactionConfigurationInput) => {
    saveConfiguration.mutate(
      { id: editingConfiguration?.id, input },
      { onSuccess: () => setDialogOpen(false) }
    );
  };

  const copyWebhook = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    toast.success('URL do webhook copiada');
  };

  const handleRefresh = () => {
    refresh();
    toast.success('Dados atualizados');
  };

  const exportSatisfactionRows = async (template = false) => {
    setExporting(true);
    try {
      const allData = template
        ? { deliveries: [], responses: [] }
        : await getAllSurveyData();
      const allResponsesByDelivery = new Map(
        allData.responses.map((response) => [response.deliveryId, response])
      );
      const exportRows = allData.deliveries.map((delivery) => ({
        delivery,
        response: allResponsesByDelivery.get(delivery.id),
      }));
      type ExportRow = (typeof exportRows)[number];

      await exportSpreadsheet<ExportRow>({
        fileName: template
          ? 'modelo-importacao-pesquisas-satisfacao.xlsx'
          : `pesquisas-satisfacao-${new Date().toISOString().slice(0, 10)}.xlsx`,
        sheetName: 'Pesquisas de Satisfação',
        columns: [
          {
            header: 'Data Agendada',
            width: 16,
            kind: 'date',
            value: (row) => row.delivery.appointmentDate,
          },
          {
            header: 'Horário',
            width: 12,
            kind: 'time',
            value: (row) => row.delivery.appointmentTime,
          },
          {
            header: 'Nome Cliente',
            width: 28,
            value: (row) => row.delivery.ownerName,
          },
          {
            header: 'Telefone',
            width: 23,
            value: (row) => row.delivery.phone,
          },
          {
            header: 'E-mail',
            width: 30,
            value: (row) => row.delivery.email,
          },
          {
            header: 'Status',
            width: 16,
            kind: 'status',
            value: (row) => row.delivery.status.toLocaleUpperCase('pt-BR'),
          },
          ...(template
            ? []
            : [
                {
                  header: 'Campanha',
                  width: 28,
                  value: (row: ExportRow) => row.delivery.configurationName,
                },
                {
                  header: 'Enviado em',
                  width: 20,
                  kind: 'datetime' as const,
                  value: (row: ExportRow) => row.delivery.sentAt,
                },
                {
                  header: 'Cadastrado em',
                  width: 20,
                  kind: 'datetime' as const,
                  value: (row: ExportRow) => row.delivery.registeredAt,
                },
                {
                  header: 'Nota',
                  width: 12,
                  kind: 'number' as const,
                  value: (row: ExportRow) => row.response?.rating,
                },
                {
                  header: 'NPS',
                  width: 10,
                  kind: 'number' as const,
                  value: (row: ExportRow) => row.response?.nps,
                },
                {
                  header: 'Comentário',
                  width: 42,
                  value: (row: ExportRow) => row.response?.comment,
                },
                {
                  header: 'Link Pesquisa',
                  width: 48,
                  value: (row: ExportRow) => row.delivery.surveyLink,
                },
              ]),
        ],
        rows: exportRows,
      });
      toast.success(template ? 'Modelo baixado' : 'Pesquisas exportadas');
    } catch (error) {
      console.error('Erro ao exportar pesquisas:', error);
      toast.error('Não foi possível gerar o arquivo Excel');
    } finally {
      setExporting(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Pesquisas de Satisfação"
        description="Controle quem recebeu, acompanhe respostas e importe resultados do Google Forms."
        actions={
          <>
            <Button
              variant="outline"
              className="min-h-11 gap-2"
              onClick={() => setImportOpen(true)}
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              Importar
            </Button>
            <Button
              variant="outline"
              className="min-h-11 gap-2"
              onClick={() => exportSatisfactionRows()}
              disabled={exporting}
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="h-4 w-4" aria-hidden="true" />
              )}
              Exportar Excel
            </Button>
            <Button
              variant="outline"
              className="min-h-11 gap-2"
              onClick={handleRefresh}
              disabled={loading}
            >
              <RefreshCw
                className={cn('h-4 w-4', loading && 'animate-spin')}
                aria-hidden="true"
              />
              Atualizar
            </Button>
            <Button className="min-h-11 gap-2" onClick={openNewConfiguration}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Nova campanha
            </Button>
          </>
        }
      />

      {setupError && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>Módulo ainda não disponível no Supabase</AlertTitle>
          <AlertDescription>{setupError}</AlertDescription>
        </Alert>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Tutores controlados"
          value={deliveries.length}
          icon={<Users />}
          hint="Sem duplicidade por campanha"
          loading={loading}
        />
        <StatCard
          title="Enviado"
          value={stats.sent}
          icon={<Send />}
          hint="Aguardando resposta"
          tone="success"
          loading={loading}
        />
        <StatCard
          title="Cadastrado"
          value={stats.registered}
          icon={<UserCheck />}
          hint={`${stats.responseRate.toFixed(1).replace('.', ',')}% de conversão`}
          loading={loading}
        />
        <StatCard
          title="Nota média"
          value={
            stats.averageRating === null
              ? '—'
              : stats.averageRating.toFixed(1).replace('.', ',')
          }
          icon={<Star />}
          hint={responses.length ? `${responses.length} respostas importadas` : 'Sem respostas'}
          tone="warning"
          loading={loading}
        />
      </div>

      <Tabs defaultValue="controle" className="space-y-4">
        <TabsList className="h-auto w-full justify-start overflow-x-auto p-1 sm:w-auto">
          <TabsTrigger value="controle" className="min-h-10 gap-2">
            <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
            Controle de envios
          </TabsTrigger>
          <TabsTrigger value="resultados" className="min-h-10 gap-2">
            <BarChart3 className="h-4 w-4" aria-hidden="true" />
            Resultados
          </TabsTrigger>
          <TabsTrigger value="integracao" className="min-h-10 gap-2">
            <Workflow className="h-4 w-4" aria-hidden="true" />
            Integração
          </TabsTrigger>
        </TabsList>

        <TabsContent value="controle" className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
                <div>
                  <CardTitle className="text-base">Tutores da pesquisa</CardTitle>
                  <CardDescription className="mt-1">
                    O mesmo telefone não pode entrar duas vezes na mesma campanha.
                  </CardDescription>
                </div>
                <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
                  <div className="relative min-w-0 flex-1 lg:w-72">
                    <Search
                      className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <label htmlFor="survey-search" className="sr-only">
                      Buscar tutor
                    </label>
                    <Input
                      id="survey-search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Buscar nome, telefone ou e-mail"
                      className="min-h-11 pl-9"
                    />
                  </div>
                  <Select
                    value={statusFilter}
                    onValueChange={(value) =>
                      setStatusFilter(value as 'todos' | SatisfactionDeliveryStatus)
                    }
                  >
                    <SelectTrigger
                      className="min-h-11 w-full sm:w-44"
                      aria-label="Filtrar por status"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os status</SelectItem>
                      {Object.entries(STATUS_META).map(([status, meta]) => (
                        <SelectItem key={status} value={status}>
                          {meta.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="space-y-2 p-4" role="status">
                  <span className="sr-only">Carregando tutores</span>
                  {Array.from({ length: 6 }).map((_, index) => (
                    <Skeleton key={index} className="h-12 w-full" />
                  ))}
                </div>
              ) : filteredDeliveries.length === 0 ? (
                <EmptyState
                  icon={<ClipboardCheck />}
                  title={
                    deliveries.length === 0
                      ? 'Nenhum tutor controlado'
                      : 'Nenhum resultado encontrado'
                  }
                  description={
                    deliveries.length === 0
                      ? 'Os registros aparecerão aqui quando o n8n preparar o primeiro envio.'
                      : 'Ajuste a busca ou o filtro de status para ver outros tutores.'
                  }
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table className="min-w-[980px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data agendada</TableHead>
                        <TableHead>Tutor</TableHead>
                        <TableHead>Contato</TableHead>
                        <TableHead>Campanha</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Último evento</TableHead>
                        <TableHead className="w-16 text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDeliveries.map((delivery) => {
                        const response = responseByDelivery.get(delivery.id);
                        return (
                          <TableRow key={delivery.id}>
                            <TableCell>
                              <div className="font-medium tabular-nums">
                                {formatDate(delivery.appointmentDate)}
                              </div>
                              <div className="text-xs tabular-nums text-muted-foreground">
                                {delivery.appointmentTime?.slice(0, 5) ?? 'Horário não informado'}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{delivery.ownerName}</div>
                              <div className="text-xs text-muted-foreground">
                                {[delivery.petName, delivery.service]
                                  .filter(Boolean)
                                  .join(' · ') || 'Sem detalhes do atendimento'}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="tabular-nums">
                                {formatPhone(delivery.phone)}
                              </div>
                              <div className="max-w-56 truncate text-xs text-muted-foreground">
                                {delivery.email || 'E-mail não informado'}
                              </div>
                            </TableCell>
                            <TableCell>{delivery.configurationName}</TableCell>
                            <TableCell>
                              <StatusBadge status={delivery.status} />
                              {delivery.error && (
                                <p className="mt-1 max-w-44 truncate text-xs text-destructive">
                                  {delivery.error}
                                </p>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm tabular-nums">
                                {formatDateTime(
                                  response?.submittedAt ??
                                    delivery.registeredAt ??
                                    delivery.sentAt ??
                                    delivery.createdAt
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {response ? 'Resposta importada' : STATUS_META[delivery.status].label}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <DeliveryActions
                                delivery={delivery}
                                pending={updateDeliveryStatus.isPending}
                                onStatusChange={(status) =>
                                  updateDeliveryStatus.mutate({
                                    id: delivery.id,
                                    status,
                                  })
                                }
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resultados" className="space-y-4">
          {responses.length === 0 && !loading ? (
            <Card className="shadow-sm">
              <EmptyState
                icon={<MessageSquareText />}
                title="As respostas ainda não chegaram"
                description="Depois que o Apps Script enviar a primeira resposta, os gráficos e comentários serão atualizados automaticamente."
              />
            </Card>
          ) : (
            <>
              <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base">Respostas ao longo do tempo</CardTitle>
                    <CardDescription>
                      Últimos 14 dias com respostas importadas.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <Skeleton className="h-64 w-full" />
                    ) : (
                      <ChartContainer
                        config={trendChartConfig}
                        className="h-64 w-full aspect-auto"
                        aria-label="Gráfico de respostas por dia"
                      >
                        <AreaChart data={results.trend} margin={{ left: -20, right: 8 }}>
                          <defs>
                            <linearGradient id="surveyTrendFill" x1="0" y1="0" x2="0" y2="1">
                              <stop
                                offset="5%"
                                stopColor="var(--color-respostas)"
                                stopOpacity={0.28}
                              />
                              <stop
                                offset="95%"
                                stopColor="var(--color-respostas)"
                                stopOpacity={0.02}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid vertical={false} />
                          <XAxis dataKey="data" tickLine={false} axisLine={false} />
                          <YAxis
                            allowDecimals={false}
                            tickLine={false}
                            axisLine={false}
                          />
                          <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent indicator="line" />}
                          />
                          <Area
                            type="monotone"
                            dataKey="respostas"
                            stroke="var(--color-respostas)"
                            strokeWidth={2}
                            fill="url(#surveyTrendFill)"
                          />
                        </AreaChart>
                      </ChartContainer>
                    )}
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base">NPS</CardTitle>
                    <CardDescription>
                      Promotores menos detratores nas respostas de 0 a 10.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <Skeleton className="h-40 w-full" />
                    ) : results.nps === null ? (
                      <EmptyState
                        icon={<TrendingUp />}
                        title="NPS não configurado"
                        description="Inclua uma pergunta de 0 a 10 no formulário e envie o valor como nps."
                        className="py-5"
                      />
                    ) : (
                      <div className="space-y-5">
                        <div>
                          <div className="flex items-end justify-between">
                            <span className="text-4xl font-bold tabular-nums">
                              {results.nps}
                            </span>
                            <Badge variant="outline">
                              {results.npsCount} respostas
                            </Badge>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {results.nps >= 75
                              ? 'Zona de excelência'
                              : results.nps >= 50
                                ? 'Zona de qualidade'
                                : results.nps >= 0
                                  ? 'Zona de aperfeiçoamento'
                                  : 'Zona crítica'}
                          </p>
                        </div>
                        <Progress
                          value={Math.max(0, Math.min(100, (results.nps + 100) / 2))}
                          aria-label={`NPS ${results.nps}`}
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>-100</span>
                          <span>0</span>
                          <span>100</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base">Distribuição das notas</CardTitle>
                    <CardDescription>Avaliações recebidas de 1 a 5.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <Skeleton className="h-64 w-full" />
                    ) : (
                      <ChartContainer
                        config={ratingChartConfig}
                        className="h-64 w-full aspect-auto"
                        aria-label="Gráfico da distribuição das notas"
                      >
                        <BarChart
                          data={results.ratingDistribution}
                          layout="vertical"
                          margin={{ left: 12, right: 12 }}
                        >
                          <CartesianGrid horizontal={false} />
                          <XAxis
                            type="number"
                            allowDecimals={false}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis
                            dataKey="nota"
                            type="category"
                            width={72}
                            tickLine={false}
                            axisLine={false}
                          />
                          <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent hideLabel />}
                          />
                          <Bar
                            dataKey="quantidade"
                            fill="var(--color-quantidade)"
                            radius={[0, 4, 4, 0]}
                          />
                        </BarChart>
                      </ChartContainer>
                    )}
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base">Comentários recentes</CardTitle>
                    <CardDescription>
                      Feedbacks abertos importados do formulário.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {responses.filter((response) => response.comment?.trim()).length ===
                      0 ? (
                        <EmptyState
                          icon={<MessageSquareText />}
                          title="Nenhum comentário"
                          description="As avaliações já estão registradas, mas ainda não há respostas abertas."
                          className="py-8"
                        />
                      ) : (
                        responses
                          .filter((response) => response.comment?.trim())
                          .slice(0, 6)
                          .map((response) => {
                            const delivery = deliveries.find(
                              (item) => item.id === response.deliveryId
                            );
                            return (
                              <article
                                key={response.id}
                                className="rounded-lg border bg-muted/20 p-3"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">
                                      {delivery?.ownerName || 'Tutor'}
                                    </span>
                                    {response.rating !== null && (
                                      <Badge variant="outline" className="gap-1">
                                        <Star
                                          className="h-3 w-3 fill-current"
                                          aria-hidden="true"
                                        />
                                        {response.rating}
                                      </Badge>
                                    )}
                                  </div>
                                  <time className="text-xs text-muted-foreground">
                                    {formatDateTime(response.submittedAt)}
                                  </time>
                                </div>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                  {response.comment}
                                </p>
                              </article>
                            );
                          })
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="integracao" className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Fluxo seguro da integração</CardTitle>
              <CardDescription>
                O navegador não recebe token do Google nem a chave de serviço do Supabase.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-5">
                {[
                  { icon: FileText, title: 'Google Forms', text: 'Tutor responde' },
                  { icon: Webhook, title: 'Apps Script', text: 'Padroniza o envio' },
                  { icon: ShieldCheck, title: 'Edge Function', text: 'Valida o segredo' },
                  { icon: Database, title: 'Supabase', text: 'Salva e deduplica' },
                  { icon: BarChart3, title: 'Dashboard', text: 'Atualiza em tempo real' },
                ].map((step, index) => (
                  <div key={step.title} className="relative rounded-lg border p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <step.icon className="h-5 w-5 text-primary" aria-hidden="true" />
                      <span className="text-xs font-medium text-muted-foreground">
                        0{index + 1}
                      </span>
                    </div>
                    <p className="text-sm font-medium">{step.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{step.text}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Campanhas configuradas</CardTitle>
                <CardDescription>
                  Formulário, link individual e mensagem usados pelo n8n.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-28 w-full" />
                    <Skeleton className="h-28 w-full" />
                  </div>
                ) : configurations.length === 0 ? (
                  <EmptyState
                    icon={<FileText />}
                    title="Nenhuma campanha configurada"
                    description="Crie a primeira campanha para liberar o link individual e a integração."
                    action={
                      <Button onClick={openNewConfiguration}>
                        <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                        Nova campanha
                      </Button>
                    }
                  />
                ) : (
                  <div className="space-y-3">
                    {configurations.map((configuration) => {
                      const ready = configurationIsReady(configuration);
                      return (
                        <div
                          key={configuration.id}
                          className="rounded-lg border bg-card p-4"
                        >
                          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium">{configuration.name}</p>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    ready
                                      ? 'border-success/20 bg-success/10 text-success'
                                      : 'border-warning/20 bg-warning/10 text-warning'
                                  )}
                                >
                                  {ready ? 'Integração pronta' : 'Requer configuração'}
                                </Badge>
                              </div>
                              <p className="mt-1 truncate text-xs text-muted-foreground">
                                ID: {configuration.googleFormId || 'não informado'}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={configuration.enabled}
                                onCheckedChange={(enabled) =>
                                  toggleConfiguration.mutate({
                                    id: configuration.id,
                                    enabled,
                                  })
                                }
                                aria-label={`${configuration.enabled ? 'Pausar' : 'Ativar'} ${configuration.name}`}
                                disabled={toggleConfiguration.isPending}
                              />
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-11 w-11"
                                onClick={() => openEditConfiguration(configuration)}
                                aria-label={`Editar ${configuration.name}`}
                              >
                                <Pencil className="h-4 w-4" aria-hidden="true" />
                              </Button>
                              {configuration.googleFormUrl && (
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-11 w-11"
                                  asChild
                                >
                                  <a
                                    href={configuration.googleFormUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    aria-label={`Abrir formulário ${configuration.name}`}
                                  >
                                    <ExternalLink
                                      className="h-4 w-4"
                                      aria-hidden="true"
                                    />
                                  </a>
                                </Button>
                              )}
                            </div>
                          </div>
                          <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                            <div className="rounded-md bg-muted/45 px-3 py-2">
                              <span className="text-muted-foreground">Pergunta token</span>
                              <p className="mt-0.5 font-mono">
                                entry.{configuration.googleTokenEntryId || '—'}
                              </p>
                            </div>
                            <div className="rounded-md bg-muted/45 px-3 py-2">
                              <span className="text-muted-foreground">
                                Tutores controlados
                              </span>
                              <p className="mt-0.5 font-medium">
                                {
                                  deliveries.filter(
                                    (delivery) =>
                                      delivery.configurationId === configuration.id
                                  ).length
                                }
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Endpoint do Google Forms</CardTitle>
                <CardDescription>
                  URL usada no Apps Script vinculado ao formulário.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border bg-muted/35 p-3">
                  <p className="break-all font-mono text-xs leading-5">{webhookUrl}</p>
                  <Button
                    variant="outline"
                    className="mt-3 min-h-11 w-full gap-2"
                    onClick={copyWebhook}
                  >
                    <Copy className="h-4 w-4" aria-hidden="true" />
                    Copiar endpoint
                  </Button>
                </div>

                <div className="space-y-3 text-sm">
                  <IntegrationCheck text="Trigger instalável “Ao enviar formulário”" />
                  <IntegrationCheck text="Header x-webhook-secret configurado" />
                  <IntegrationCheck text="Pergunta obrigatória com tracking token" />
                  <IntegrationCheck text="Edge Function publicada com verify_jwt=false" />
                </div>

                <Alert>
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  <AlertTitle>Segredo fora do Dashboard</AlertTitle>
                  <AlertDescription>
                    Configure <code>GOOGLE_FORMS_WEBHOOK_SECRET</code> somente no Apps
                    Script e nos Secrets da Edge Function.
                  </AlertDescription>
                </Alert>

                <p className="text-xs leading-5 text-muted-foreground">
                  O passo a passo e o código pronto do Apps Script estão em{' '}
                  <code>docs/pesquisas-satisfacao-google-forms.md</code>.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <SatisfactionConfigurationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        configuration={editingConfiguration}
        isPending={saveConfiguration.isPending}
        onSubmit={handleSave}
      />

      <SpreadsheetImportDialog<SatisfactionSpreadsheetImportRow>
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Importar controles de satisfação"
        description="Importe os tutores e seus status da planilha antiga sem criar contatos duplicados na campanha."
        configurationLabel="Campanha de satisfação"
        configurations={configurations.map((configuration) => ({
          id: configuration.id,
          name: configuration.name,
        }))}
        requiredColumns={[
          'Data Agendada',
          'Horário',
          'Nome Cliente',
          'Telefone',
          'E-mail',
          'Status',
        ]}
        parseFile={parseSatisfactionSpreadsheet}
        onImport={(configurationId, rows) =>
          importDeliveries.mutateAsync({ configurationId, rows })
        }
        onDownloadTemplate={() => exportSatisfactionRows(true)}
      />
    </PageContainer>
  );
};

interface DeliveryActionsProps {
  delivery: SatisfactionDelivery;
  pending: boolean;
  onStatusChange: (status: SatisfactionDeliveryStatus) => void;
}

const DeliveryActions = ({
  delivery,
  pending,
  onStatusChange,
}: DeliveryActionsProps) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button
        variant="ghost"
        size="icon"
        className="h-11 w-11"
        aria-label={`Ações de ${delivery.ownerName}`}
        disabled={pending}
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        )}
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuLabel>Corrigir status</DropdownMenuLabel>
      <DropdownMenuSeparator />
      {(Object.keys(STATUS_META) as SatisfactionDeliveryStatus[]).map((status) => {
        const Icon = STATUS_META[status].icon;
        return (
          <DropdownMenuItem
            key={status}
            onSelect={() => onStatusChange(status)}
            disabled={delivery.status === status}
          >
            <Icon className="mr-2 h-4 w-4" aria-hidden="true" />
            {STATUS_META[status].label}
            {delivery.status === status && (
              <Check className="ml-auto h-4 w-4" aria-hidden="true" />
            )}
          </DropdownMenuItem>
        );
      })}
      {delivery.surveyLink && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <a href={delivery.surveyLink} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
              Abrir link individual
            </a>
          </DropdownMenuItem>
        </>
      )}
    </DropdownMenuContent>
  </DropdownMenu>
);

const IntegrationCheck = ({ text }: { text: string }) => (
  <div className="flex items-start gap-2">
    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
    <span>{text}</span>
  </div>
);

export default SatisfactionSurveysPage;
