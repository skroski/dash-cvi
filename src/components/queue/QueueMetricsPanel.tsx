import QueueMetricsTab from '@/components/queue/QueueMetricsTab';
import { useQueue } from '@/hooks/useVetbotsModules';

/**
 * Métricas da fila presencial (TME, TMA, volume por serviço e sala, ausências) para a aba "Fila presencial"
 * de /metrics. Fica num componente próprio para o hook (consulta + Realtime) só rodar quando a aba é aberta.
 */
export default function QueueMetricsPanel() {
  const { items, services, rooms } = useQueue();
  return <QueueMetricsTab items={items.data ?? []} services={services.data ?? []} rooms={rooms.data ?? []} />;
}
