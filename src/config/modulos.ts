import {
  BarChart3,
  BellRing,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  FileAudio,
  Headset,
  Home,
  type LucideIcon,
  MessageSquare,
  MonitorPlay,
  ListOrdered,
  Sparkles,
  QrCode,
  Pill,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Stethoscope,
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
const VET_E_STAFF: Papel[] = ['admin', 'lider', 'atendente', 'veterinario'];
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
  // Calendário desabilitado temporariamente
  // { url: '/schedule', title: 'Calendário & Agenda', icon: CalendarDays, papeis: VET_E_STAFF, grupo: 'menu' },
  { url: '/prontuario', title: 'Prontuário IA', icon: FileAudio, papeis: VET_E_STAFF, grupo: 'menu' },
  { url: '/receituario', title: 'Receituário IA', icon: Stethoscope, papeis: VET_E_STAFF, grupo: 'menu' },
  { url: '/bulario', title: 'Bulário Clínico', icon: Pill, papeis: VET_E_STAFF, grupo: 'menu' },
  { url: '/web-chat', title: 'Chat Web', icon: MessageSquare, papeis: TODOS, grupo: 'menu' },
  { url: '/queue', title: 'Fila presencial', icon: ListOrdered, papeis: VET_E_STAFF, grupo: 'menu' },
  { url: '/tv', title: 'Painel TV', icon: MonitorPlay, papeis: VET_E_STAFF, grupo: null },

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

  // Conexão WhatsApp UAZAPI
  { url: '/uazapi', title: 'Conexão WhatsApp', icon: QrCode, papeis: TODOS, grupo: 'menu' },

  // Base de Conhecimento & RAG
  { url: '/knowledge', title: 'Base de Conhecimento (RAG)', icon: BookOpen, papeis: GESTORES, grupo: 'menu' },

  // Administração — só admin
  { url: '/evolution', title: 'Conexão WhatsApp (Legado)', icon: QrCode, papeis: SO_ADMIN, grupo: null },
  { url: '/configuration', title: 'Configurações', icon: Settings, papeis: SO_ADMIN, grupo: 'sistema' },
  // Regras da agenda desabilitadas temporariamente
  // { url: '/agenda-configuracao', title: 'Regras da agenda', icon: CalendarDays, papeis: SO_ADMIN, grupo: 'sistema' },
  { url: '/atendimento-configuracao', title: 'Config. do atendimento', icon: SlidersHorizontal, papeis: SO_ADMIN, grupo: 'sistema' },
  { url: '/my-prompt', title: 'Meu Prompt', icon: Sparkles, papeis: SO_ADMIN, grupo: 'sistema' },
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
export function papelEfetivo(papel: Papel | null, setupPendente: boolean, userEmail?: string | null): Papel {
  if (userEmail && (userEmail.toLowerCase().includes('vet') || userEmail.toLowerCase().includes('veterinario')) && !papel) {
    return 'veterinario';
  }
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
