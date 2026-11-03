import { Link, useLocation } from 'react-router-dom';
import { BookOpen, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { ThemeToggle } from '@/components/ThemeToggle';
import NotificationsBell from '@/components/notifications/NotificationsBell';
import AtendenteAtivoSelector from '@/components/atendentes/AtendenteAtivoSelector';
import HelpMenuButton from '@/components/help/HelpMenuButton';
import StatusSelector from '@/components/atendentes/StatusSelector';
import { getRouteTitle } from './routeMeta';
import { useAuth } from '@/context/AuthContext';
import { papelEfetivo } from '@/config/modulos';

const AppHeader = () => {
  const location = useLocation();
  const title = getRouteTitle(location.pathname);
  const { papel, setupPendente, user } = useAuth();
  const papelAtual = papelEfetivo(papel, setupPendente, user?.email);
  const isVet = papelAtual === 'veterinario';
  const isGestor = papelAtual === 'admin' || papelAtual === 'lider';

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-card px-4">
      <SidebarTrigger aria-label="Alternar menu lateral" className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 h-5" />
      <h1 className="truncate text-base font-semibold">{title}</h1>
      <div className="ml-auto flex items-center gap-2">
        {!isVet && <StatusSelector />}
        {!isVet && <AtendenteAtivoSelector />}
        {isGestor && (
          <Button variant="outline" size="sm" asChild className="hidden md:flex gap-1.5 text-xs">
            <Link to="/knowledge">
              <BookOpen className="h-3.5 w-3.5 text-primary" />
              <span>Base RAG</span>
            </Link>
          </Button>
        )}
        <Button variant="outline" size="sm" asChild className="hidden sm:flex gap-1.5 text-xs">
          <Link to="/uazapi">
            <QrCode className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>WhatsApp</span>
          </Link>
        </Button>
        <NotificationsBell />
        <HelpMenuButton />
        <ThemeToggle />
      </div>
    </header>
  );
};

export default AppHeader;
