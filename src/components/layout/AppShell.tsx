import { Outlet } from 'react-router-dom';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import AppSidebar from './AppSidebar';
import AppHeader from './AppHeader';
import GlobalMessageNotifications from '@/components/notifications/GlobalMessageNotifications';

const AppShell = () => {
  return (
    <SidebarProvider>
      <GlobalMessageNotifications />
      <AppSidebar />
      <SidebarInset className="flex h-svh flex-col overflow-hidden">
        <AppHeader />
        <div className="min-h-0 flex-1">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default AppShell;
