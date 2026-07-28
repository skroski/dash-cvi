import { useState } from "react";
import { Users, PawPrint, UserPlus, MessageSquare, Activity, Clock, AlertTriangle, RefreshCw, Headset, CheckCircle2, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/shared/PageHeader";
import StatCard from "@/components/shared/StatCard";
import PeriodSelector from "@/components/metrics/PeriodSelector";
import { MetricsPeriod, PERIOD_LABELS } from "@/lib/metricsPeriod";
import { useClientStats } from "@/hooks/useClientStats";
import { useServiceStats } from "@/hooks/useServiceStats";
import { useChatMetrics } from "@/hooks/useChatMetrics";
import { useAtendimentoMetrics, formatDurationShort } from "@/hooks/useAtendimentoMetrics";
import { useRealtimeInvalidation } from "@/hooks/useRealtimeInvalidation";

import ClientGrowthChart from "@/components/metrics/ClientGrowthChart";
import PetTypesChart from "@/components/metrics/PetTypesChart";
import ServicesBarChart from "@/components/metrics/ServicesBarChart";
import RecentClientsTable from "@/components/metrics/RecentClientsTable";
import MessageVolumeByHourChart from "@/components/metrics/MessageVolumeByHourChart";
import ChatVolumeByWeekdayChart from "@/components/metrics/ChatVolumeByWeekdayChart";
import IdleClientsTable from "@/components/metrics/IdleClientsTable";
import BotResponseTimeChart from "@/components/metrics/BotResponseTimeChart";
import ConversationSizeChart from "@/components/metrics/ConversationSizeChart";
import BotVsHumanChart from "@/components/metrics/BotVsHumanChart";
import NewChatsMonthlyChart from "@/components/metrics/NewChatsMonthlyChart";
import AttendantsBarChart from "@/components/metrics/AttendantsBarChart";
import DepartmentsChart from "@/components/metrics/DepartmentsChart";
import TagsUsageChart from "@/components/metrics/TagsUsageChart";
import AtendimentoTrendChart from "@/components/metrics/AtendimentoTrendChart";
import OpenAttendancesTable from "@/components/metrics/OpenAttendancesTable";
import FinalizedAttendancesTable from "@/components/metrics/FinalizedAttendancesTable";

const MetricsDashboard = () => {
  const [activeTab, setActiveTab] = useState("clientes");
  const [period, setPeriod] = useState<MetricsPeriod>("30d");

  const { stats, loading, error: clientError, refetchStats } = useClientStats(period);
  const { services, loading: servicesLoading, error: servicesError, fetchServices } = useServiceStats(activeTab === "clientes");
  // O scan do histórico (useChatMetrics) é reaproveitado na aba Atendimentos
  // para o indicador "Aguardando" — mesma queryKey, sem varrer duas vezes.
  const {
    metrics: chatMetrics,
    loading: chatLoading,
    error: chatError,
    fetchChatMetrics,
  } = useChatMetrics(period, activeTab === "chats" || activeTab === "atendimentos");
  const {
    metrics: atendimentoMetrics,
    loading: atendimentoLoading,
    error: atendimentoError,
    fetchAtendimentoMetrics,
  } = useAtendimentoMetrics(period, activeTab === "atendimentos");

  // Invalida as queries automaticamente quando dados_cliente muda no Supabase
  useRealtimeInvalidation();

  const handleRefresh = () => {
    refetchStats();
    if (activeTab === "clientes") fetchServices();
    if (activeTab === "chats") fetchChatMetrics();
    if (activeTab === "atendimentos") {
      fetchAtendimentoMetrics();
      fetchChatMetrics();
    }
  };

  const isRefreshing =
    loading ||
    (activeTab === "chats"
      ? chatLoading
      : activeTab === "atendimentos"
        ? atendimentoLoading
        : servicesLoading);

  return (
    <PageContainer>
      <PageHeader
        title="Métricas"
        description={`Dados dos ${PERIOD_LABELS[period]}`}
        actions={
          <>
            <PeriodSelector value={period} onChange={setPeriod} />
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} aria-hidden="true" />
              Atualizar
            </Button>
          </>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="clientes" className="gap-2">
            <Users className="h-4 w-4" aria-hidden="true" />
            Clientes
          </TabsTrigger>
          <TabsTrigger value="chats" className="gap-2">
            <MessageSquare className="h-4 w-4" aria-hidden="true" />
            Chats & Bot
          </TabsTrigger>
          <TabsTrigger value="atendimentos" className="gap-2">
            <Headset className="h-4 w-4" aria-hidden="true" />
            Atendimentos
          </TabsTrigger>
        </TabsList>

        {/* ─── TAB: CLIENTES ─── */}
        <TabsContent value="clientes" className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            <StatCard
              title="Total de Clientes"
              value={stats.totalClients}
              icon={<Users />}
              hint={`+${stats.newClientsThisMonth} este mês`}
              loading={loading}
            />
            <StatCard
              title="Total de Pets"
              value={stats.totalPets}
              icon={<PawPrint />}
              hint={`Média de ${(stats.totalPets / (stats.totalClients || 1)).toFixed(1)} pets por cliente`}
              loading={loading}
            />
            <StatCard
              title="Novos Clientes (Mês)"
              value={stats.newClientsThisMonth}
              icon={<UserPlus />}
              hint="Cadastros desde o dia 1º"
              tone="success"
              loading={loading}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
            <ClientGrowthChart
              data={stats.monthlyGrowth}
              loading={loading}
              error={clientError}
              onRetry={refetchStats}
            />
            <ServicesBarChart
              data={services}
              loading={servicesLoading}
              error={servicesError}
              onRetry={fetchServices}
            />
          </div>

          <PetTypesChart
            data={stats.petBreeds}
            loading={loading}
            error={clientError}
            onRetry={refetchStats}
          />

          <RecentClientsTable clients={stats.recentClients} loading={loading} />
        </TabsContent>

        {/* ─── TAB: CHATS & BOT ─── */}
        <TabsContent value="chats" className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            <StatCard
              title="Total de Conversas"
              value={chatMetrics.kpis.totalConversations}
              icon={<MessageSquare />}
              hint="Sessões únicas no período"
              loading={chatLoading}
              href="/chats"
            />
            <StatCard
              title="Ativas Hoje"
              value={chatMetrics.kpis.activeTodayConversations}
              icon={<Activity />}
              hint="Conversas com mensagem hoje"
              tone="success"
              loading={chatLoading}
              href="/chats"
            />
            <StatCard
              title="Sem Resposta (+1h)"
              value={chatMetrics.kpis.idleClientsOver1h}
              icon={<Clock />}
              hint="Clientes aguardando resposta"
              tone={chatMetrics.kpis.idleClientsOver1h > 0 ? "warning" : "default"}
              loading={chatLoading}
              href="/chats?filter=unanswered"
            />
            <StatCard
              title="Ociosos (+24h)"
              value={chatMetrics.kpis.idleClientsOver24h}
              icon={<AlertTriangle />}
              hint="Sem resposta há mais de 1 dia"
              tone={chatMetrics.kpis.idleClientsOver24h > 0 ? "destructive" : "default"}
              loading={chatLoading}
              href="/chats?filter=unanswered"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
            <MessageVolumeByHourChart
              data={chatMetrics.hourlyVolume}
              loading={chatLoading}
              error={chatError}
              onRetry={fetchChatMetrics}
            />
            <ChatVolumeByWeekdayChart
              data={chatMetrics.weekdayVolume}
              loading={chatLoading}
              error={chatError}
              onRetry={fetchChatMetrics}
            />
          </div>

          <NewChatsMonthlyChart
            data={chatMetrics.newChatsMonthly}
            loading={chatLoading}
            error={chatError}
            onRetry={fetchChatMetrics}
          />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
            <BotResponseTimeChart
              data={chatMetrics.botResponseTime}
              loading={chatLoading}
              error={chatError}
              onRetry={fetchChatMetrics}
            />
            <BotVsHumanChart
              data={chatMetrics.botVsHuman}
              loading={chatLoading}
              error={chatError}
              onRetry={fetchChatMetrics}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
            <ConversationSizeChart
              data={chatMetrics.conversationSizes}
              loading={chatLoading}
              error={chatError}
              onRetry={fetchChatMetrics}
            />
            <IdleClientsTable clients={chatMetrics.idleClients} loading={chatLoading} />
          </div>
        </TabsContent>

        {/* ─── TAB: ATENDIMENTOS ─── */}
        <TabsContent value="atendimentos" className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            <StatCard
              title="Em Atendimento Humano"
              value={atendimentoMetrics.kpis.emAtendimento}
              icon={<Headset />}
              hint="Conversas com a equipe agora"
              loading={atendimentoLoading}
            />
            <StatCard
              title="Aguardando Resposta"
              value={chatMetrics.kpis.idleClientsOver1h}
              icon={<Clock />}
              hint="Sem resposta há mais de 1h"
              tone={chatMetrics.kpis.idleClientsOver1h > 0 ? "warning" : "default"}
              loading={chatLoading}
              href="/chats?filter=unanswered"
            />
            <StatCard
              title="Finalizados"
              value={atendimentoMetrics.kpis.finalizadosPeriodo}
              icon={<CheckCircle2 />}
              hint={`Conversas fechadas nos ${PERIOD_LABELS[period]}`}
              tone="success"
              loading={atendimentoLoading}
            />
            <StatCard
              title="Tempo Médio de Atendimento"
              value={
                atendimentoMetrics.kpis.tempoMedioMinutos > 0
                  ? formatDurationShort(atendimentoMetrics.kpis.tempoMedioMinutos)
                  : "—"
              }
              icon={<Timer />}
              hint="Da abertura ao encerramento"
              loading={atendimentoLoading}
            />
          </div>

          <AtendimentoTrendChart
            data={atendimentoMetrics.tendencia}
            loading={atendimentoLoading}
            error={atendimentoError}
            onRetry={fetchAtendimentoMetrics}
          />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
            <AttendantsBarChart
              data={atendimentoMetrics.porAtendente}
              loading={atendimentoLoading}
              error={atendimentoError}
              onRetry={fetchAtendimentoMetrics}
            />
            <DepartmentsChart
              data={atendimentoMetrics.porDepartamento}
              loading={atendimentoLoading}
              error={atendimentoError}
              onRetry={fetchAtendimentoMetrics}
            />
          </div>

          <TagsUsageChart
            data={atendimentoMetrics.tagsMaisUsadas}
            loading={atendimentoLoading}
            error={atendimentoError}
            onRetry={fetchAtendimentoMetrics}
          />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
            <OpenAttendancesTable data={atendimentoMetrics.emAtendimentoLista} loading={atendimentoLoading} />
            <FinalizedAttendancesTable data={atendimentoMetrics.finalizadosLista} loading={atendimentoLoading} />
          </div>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
};

export default MetricsDashboard;
