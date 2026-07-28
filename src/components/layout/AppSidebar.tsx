import { NavLink, useLocation } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import { useAuth } from '@/context/AuthContext';
import { type Modulo, modulosDoGrupo, papelEfetivo } from '@/config/modulos';

const AppSidebar = () => {
  const location = useLocation();
  const { user, signOut, papel, setupPendente } = useAuth();

  // Os itens vêm do registro de módulos, a mesma fonte que o ModuloGuard usa —
  // é o que garante que nada fique escondido no menu mas acessível pela URL.
  const papelAtual = papelEfetivo(papel, setupPendente);
  const mainNav = modulosDoGrupo('menu', papelAtual);
  const systemNav = modulosDoGrupo('sistema', papelAtual);
  const gestaoNav = modulosDoGrupo('gestao', papelAtual);

  const userEmail = user?.email ?? '';
  const userName =
    (user?.user_metadata?.name as string | undefined) ??
    userEmail.split('@')[0] ??
    'Usuário';
  const initials = userName
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const renderItems = (items: Modulo[]) =>
    items.map((item) => (
      <SidebarMenuItem key={item.url}>
        <SidebarMenuButton
          asChild
          isActive={location.pathname === item.url}
          tooltip={item.title}
        >
          <NavLink to={item.url}>
            <item.icon aria-hidden="true" />
            <span>{item.title}</span>
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    ));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-1 px-1 py-1">
          <img
            src="/assets/images/logo-light.png"
            alt="VetBots"
            className="h-12  shrink-0 rounded-md object-contain"
          />
          
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(mainNav)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Some inteiro para quem não tem nenhum módulo de sistema (atendente),
            em vez de deixar um cabeçalho de grupo vazio. */}
        {systemNav.length + gestaoNav.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Sistema</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {renderItems(systemNav)}
                {renderItems(gestaoNav)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-2 px-2 py-1.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
              <span
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground"
                aria-hidden="true"
              >
                {initials || 'U'}
              </span>
              <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                <p className="truncate text-sm font-medium text-sidebar-accent-foreground">{userName}</p>
                <p className="truncate text-xs text-sidebar-foreground/70">{userEmail}</p>
              </div>
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Sair" onClick={signOut}>
              <LogOut aria-hidden="true" />
              <span>Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
};

export default AppSidebar;
