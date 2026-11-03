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
  const papelAtual = papelEfetivo(papel, setupPendente, user?.email);
  const isVet = papelAtual === 'veterinario';
  const mainNav = modulosDoGrupo('menu', papelAtual);
  const systemNav = modulosDoGrupo('sistema', papelAtual);
  const gestaoNav = modulosDoGrupo('gestao', papelAtual);

  const userEmail = user?.email ?? '';
  const userName =
    (user?.user_metadata?.name as string | undefined) ??
    (isVet ? 'Veterinários' : userEmail.split('@')[0]) ??
    'Usuário';
  const initials = isVet
    ? 'VT'
    : userName
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
          {/* `data-tour` é a âncora estável do tour guiado; o Slot do Radix
              repassa para o <a> renderizado. Não afeta estilo nem navegação. */}
          <NavLink to={item.url} data-tour={`nav:${item.url}`}>
            <item.icon aria-hidden="true" />
            <span>{item.title}</span>
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    ));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-1 px-1 py-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <img
            src="/assets/images/logo-light.png"
            alt="C.V.I. - Centro Veterinário Integrado"
            className="h-12 shrink-0 rounded-md object-contain group-data-[collapsible=icon]:hidden"
          />
          <img
            src="/assets/images/logo-icon.png"
            alt="C.V.I. - Centro Veterinário Integrado"
            className="hidden h-9 w-9 shrink-0 object-contain group-data-[collapsible=icon]:block"
          />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{isVet ? 'Painel Veterinário' : 'Menu'}</SidebarGroupLabel>
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
