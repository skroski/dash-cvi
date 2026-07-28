import {
  BarChart3,
  BellRing,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  Headset,
  Home,
  type LucideIcon,
  MessageSquare,
  QrCode,
  Settings,
  ShieldCheck,
  Users,
  UsersRound,
} from 'lucide-react';
import { Papel } from '@/types/perfil';

/** Onde o módulo aparece na barra lateral (`null` = rota sem item de menu). */
type GrupoMenu = 'menu' | 'sistema' | 'gestao' | null;

export interface Modulo {
  url: string;
  title: string;
  icon: LucideIcon;
  /** Papéis que podem abrir a rota. */
  papeis: Papel[];
  grupo: GrupoMenu;
}

const TODOS: Papel[] = ['admin', 'lider', 'atendente'];
const GESTORES: Papel[] = ['admin', 'lider'];
const SO_ADMIN: Papel[] = ['admin'];

/**
 * Fonte única de verdade da visibilidade de módulos. A barra lateral e o guard
 * de rota leem daqui — assim não existe menu escondido cuja URL ainda funciona.
 *
 * Isto é conveniência e clareza de interface, não a barreira de segurança: o
 * que protege os dados é a RLS no banco. Esconder um item de menu não impede
 * ninguém de consultar a API do Supabase diretamente.
 */
export const MODULOS: Modulo[] = [
  // Operação do dia a dia — todo mundo
  { url: '/dashboard', title: 'Início', icon: Home, papeis: TODOS, grupo: 'menu' },
  { url: '/chats', title: 'Conversas', icon: MessageSquare, papeis: TODOS, grupo: 'menu' },
  { url: '/groups', title: 'Grupos', icon: UsersRound, papeis: TODOS, grupo: 'menu' },
  { url: '/clients', title: 'Clientes', icon: Users, papeis: TODOS, grupo: 'menu' },
  { url: '/reminders', title: 'Lembretes', icon: BellRing, papeis: TODOS, grupo: 'menu' },
  { url: '/schedule', title: 'Agenda', icon: CalendarDays, papeis: TODOS, grupo: null },

  // Acompanhamento e gestão de equipe — líder e admin
  { url: '/metrics', title: 'Métricas', icon: BarChart3, papeis: GESTORES, grupo: 'menu' },
  { url: '/attendants', title: 'Atendentes', icon: Headset, papeis: GESTORES, grupo: 'menu' },
  {
    url: '/satisfaction-surveys',
    title: 'Pesquisas',
    icon: ClipboardCheck,
    papeis: GESTORES,
    grupo: 'menu',
  },

  // Administração — só admin
  { url: '/evolution', title: 'Conexão WhatsApp', icon: QrCode, papeis: SO_ADMIN, grupo: 'sistema' },
  { url: '/knowledge', title: 'Conhecimento', icon: BookOpen, papeis: SO_ADMIN, grupo: null },
  { url: '/configuration', title: 'Configurações', icon: Settings, papeis: SO_ADMIN, grupo: null },
  {
    url: '/users',
    title: 'Usuários e auditoria',
    icon: ShieldCheck,
    papeis: SO_ADMIN,
    grupo: 'gestao',
  },
];

const MODULO_POR_URL = new Map(MODULOS.map((modulo) => [modulo.url, modulo]));

/**
 * Papel a considerar na interface.
 *
 * Enquanto as migrações de perfil não forem aplicadas (`setupPendente`), o
 * painel continua funcionando como antes — acesso total — em vez de esconder
 * tudo de todo mundo. Já um usuário autenticado sem perfil cadastrado recebe o
 * menor privilégio, e não o maior.
 */
export function papelEfetivo(papel: Papel | null, setupPendente: boolean): Papel {
  if (setupPendente) return 'admin';
  return papel ?? 'atendente';
}

/** Rotas fora do registro (ex.: 404) seguem liberadas. */
export function podeAcessarRota(pathname: string, papel: Papel): boolean {
  const modulo = MODULO_POR_URL.get(pathname);
  if (!modulo) return true;
  return modulo.papeis.includes(papel);
}

export function modulosDoGrupo(grupo: Exclude<GrupoMenu, null>, papel: Papel): Modulo[] {
  return MODULOS.filter((modulo) => modulo.grupo === grupo && modulo.papeis.includes(papel));
}
