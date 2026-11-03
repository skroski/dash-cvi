import { Link } from 'react-router-dom';
import { Users, PawPrint, UserPlus, PauseCircle, MessageSquareWarning, BarChart3, QrCode, Plus, BellRing, ClipboardCheck, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PageContainer from '@/components/layout/PageContainer';
import StatCard from '@/components/shared/StatCard';
import RecentClientsTable from '@/components/metrics/RecentClientsTable';
import { DashboardAppointmentsList } from '@/components/schedule/DashboardAppointmentsList';
import { useAuth } from '@/context/AuthContext';
import { useDashboardSummary } from '@/hooks/useDashboardSummary';
import { useRedisPauseStatus } from '@/hooks/useRedisPauseStatus';

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
};

const Dashboard = () => {
  const { user } = useAuth();
  const { summary, loading } = useDashboardSummary();
  const pauseStatus = useRedisPauseStatus();

  const userName =
    (user?.user_metadata?.name as string | undefined) ??
    user?.email?.split('@')[0] ??
    '';

  const today = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <PageContainer>
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight">
          {getGreeting()}{userName ? `, ${userName}` : ''}!
        </h2>
        <p className="mt-1 text-sm capitalize text-muted-foreground">{today}</p>
      </div>

      <div
        className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6"
        data-tour="dashboard-stats"
      >
        <StatCard
          title="Total de Clientes"
          value={summary?.totalClients ?? 0}
          icon={<Users />}
          loading={loading}
          href="/clients"
        />
        <StatCard
          title="Novos Clientes (Mês)"
          value={summary?.newClientsThisMonth ?? 0}
          icon={<UserPlus />}
          tone="success"
          loading={loading}
          href="/metrics"
        />
        <StatCard
          title="Total de Pets"
          value={summary?.totalPets ?? 0}
          icon={<PawPrint />}
          loading={loading}
          href="/clients"
        />
        <StatCard
          title="Bots Pausados"
          value={pauseStatus?.size ?? 0}
          icon={<PauseCircle />}
          tone={(pauseStatus?.size ?? 0) > 0 ? 'warning' : 'default'}
          hint="Conversas em atendimento humano"
          loading={false}
          href="/chats?filter=paused"
          dataTour="dashboard-bots-pausados"
        />
      </div>

      <Card className="mb-6 shadow-sm" data-tour="dashboard-quick-actions">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Ações rápidas</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="default" className="gap-2">
            <Link to="/chats?filter=unanswered">
              <MessageSquareWarning className="h-4 w-4" aria-hidden="true" />
              Conversas sem resposta
            </Link>
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/metrics">
              <BarChart3 className="h-4 w-4" aria-hidden="true" />
              Ver métricas
            </Link>
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/clients">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Adicionar cliente
            </Link>
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/evolution">
              <QrCode className="h-4 w-4" aria-hidden="true" />
              Conectar WhatsApp
            </Link>
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/reminders">
              <BellRing className="h-4 w-4" aria-hidden="true" />
              Gerenciar lembretes
            </Link>
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/satisfaction-surveys">
              <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
              Pesquisas de satisfação
            </Link>
          </Button>
          {/* <Button asChild variant="outline" className="gap-2">
            <Link to="/schedule">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              Ver agenda
            </Link>
          </Button> */}
        </CardContent>
      </Card>

      {/* <DashboardAppointmentsList /> */}

      <div data-tour="dashboard-recent">
        <RecentClientsTable clients={summary?.recentClients ?? []} loading={loading} />
      </div>
    </PageContainer>
  );
};

export default Dashboard;
