import { useLocation } from 'react-router-dom';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { ThemeToggle } from '@/components/ThemeToggle';
import NotificationsBell from '@/components/notifications/NotificationsBell';
import AtendenteAtivoSelector from '@/components/atendentes/AtendenteAtivoSelector';
import StatusSelector from '@/components/atendentes/StatusSelector';
import { getRouteTitle } from './routeMeta';

const AppHeader = () => {
  const location = useLocation();
  const title = getRouteTitle(location.pathname);

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-card px-4">
      <SidebarTrigger aria-label="Alternar menu lateral" className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 h-5" />
      <h1 className="truncate text-base font-semibold">{title}</h1>
      <div className="ml-auto flex items-center gap-2">
        <StatusSelector />
        <AtendenteAtivoSelector />
        <NotificationsBell />
        <ThemeToggle />
      </div>
    </header>
  );
};

export default AppHeader;
