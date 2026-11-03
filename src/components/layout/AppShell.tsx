import { Outlet } from 'react-router-dom';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import AppSidebar from './AppSidebar';
import AppHeader from './AppHeader';
import GlobalMessageNotifications from '@/components/notifications/GlobalMessageNotifications';
import { TourProvider } from '@/tour/TourProvider';

const AppShell = () => {
  return (
    <SidebarProvider>
      {/* TourProvider fica dentro do SidebarProvider porque o tour precisa abrir
          a barra lateral sozinho (obrigatório no mobile, onde ela é um Sheet). */}
      <TourProvider>
        <GlobalMessageNotifications />
        <AppSidebar />
        <SidebarInset className="flex h-svh flex-col overflow-hidden">
          <AppHeader />
          <div className="min-h-0 flex-1">
            <Outlet />
          </div>
        </SidebarInset>
      </TourProvider>
    </SidebarProvider>
  );
};

export default AppShell;
