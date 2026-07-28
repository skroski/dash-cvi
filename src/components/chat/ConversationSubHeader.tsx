import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Search,
  X,
  RefreshCw,
  PauseCircle,
  AlertCircle,
  TimerReset,
  ClipboardList,
  Tag as TagIcon,
  Check,
  Loader2,
  Archive,
  CheckCircle2,
  CircleDot,
  ListFilter,
  UserCheck,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ChatViewMode,
  Conversation,
  ConversationAssignmentFilter,
  ConversationStatusFilter,
} from '@/types/chat';
import { Tag } from '@/types/crm';

const STATUS_FILTER_OPTIONS: {
  value: ConversationStatusFilter;
  label: string;
  icon: React.ElementType;
}[] = [
  { value: 'todas', label: 'Todas as conversas', icon: ListFilter },
  { value: 'aberta', label: 'Abertas', icon: CircleDot },
  { value: 'fechada', label: 'Fechadas', icon: CheckCircle2 },
  { value: 'arquivada', label: 'Arquivadas', icon: Archive },
];

interface ConversationSubHeaderProps {
  selectedConversation?: Conversation;
  onConversationUpdate: () => void;
  onSearchConversations?: (searchTerm: string) => void;
  searchValue?: string;
  conversationCount?: number;
  searching?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  autoRefresh?: boolean;
  onToggleAutoRefresh?: () => void;
  showOnlyPaused?: boolean;
  onTogglePausedFilter?: () => void;
  showOnlyUnanswered?: boolean;
  onToggleUnansweredFilter?: () => void;
  showOnlyPendencias?: boolean;
  onTogglePendenciasFilter?: () => void;
  /** Definido pela rota: /chats (conversas) ou /groups (grupos). */
  viewMode?: ChatViewMode;
  tagFilterId?: number | null;
  onTagFilterChange?: (tagId: number | null) => void;
  tags?: Tag[];
  statusFilter?: ConversationStatusFilter;
  onStatusFilterChange?: (status: ConversationStatusFilter) => void;
  assignmentFilter?: ConversationAssignmentFilter;
  onAssignmentFilterChange?: (filter: ConversationAssignmentFilter) => void;
  /** Nome do atendente ativo no painel; null oculta o filtro Atribuídas/Todas. */
  atendenteAtivoNome?: string | null;
}

/** Chip de filtro compacto (pílula) — ativo ganha o tom do tema. */
const filterChipClasses = (active: boolean) =>
  cn(
    'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    active
      ? 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/15'
      : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
  );

/** Botão de ação compacto (ícone) do topo da lista. */
const iconActionClasses = (active = false) =>
  cn(
    'h-8 w-8',
    active && 'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary'
  );

const ConversationSubHeader = ({
  onSearchConversations,
  searchValue = '',
  conversationCount = 0,
  searching = false,
  onRefresh,
  isRefreshing = false,
  autoRefresh = false,
  onToggleAutoRefresh,
  showOnlyPaused = false,
  onTogglePausedFilter,
  showOnlyUnanswered = false,
  onToggleUnansweredFilter,
  showOnlyPendencias = false,
  onTogglePendenciasFilter,
  viewMode = 'chats',
  tagFilterId = null,
  onTagFilterChange,
  tags = [],
  statusFilter = 'todas',
  onStatusFilterChange,
  assignmentFilter = 'todas',
  onAssignmentFilterChange,
  atendenteAtivoNome = null
}: ConversationSubHeaderProps) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(searchValue);
  const [isTagFilterOpen, setIsTagFilterOpen] = useState(false);
  const [isStatusFilterOpen, setIsStatusFilterOpen] = useState(false);

  const activeTag = tagFilterId !== null ? tags.find(tag => tag.id === tagFilterId) : undefined;
  const activeStatusOption =
    STATUS_FILTER_OPTIONS.find(option => option.value === statusFilter) ?? STATUS_FILTER_OPTIONS[0];
  const ActiveStatusIcon = activeStatusOption.icon;

  useEffect(() => {
    setSearchTerm(searchValue);
    if (searchValue) {
      setIsSearchOpen(true);
    }
  }, [searchValue]);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    if (onSearchConversations) {
      onSearchConversations(value);
    }
  };

  const clearSearch = () => {
    setSearchTerm('');
    if (onSearchConversations) {
      onSearchConversations('');
    }
    setIsSearchOpen(false);
  };

  return (
    <div className="border-b bg-muted/50 px-3 pb-2.5 pt-2">
      {/* Linha 1: título (definido pela rota) + contagem + ações */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">
          {viewMode === 'groups' ? 'Grupos' : 'Conversas'}
        </span>

        <div className="flex items-center gap-0.5">
          <Badge variant="secondary" className="mr-1 tabular-nums">
            {conversationCount}
          </Badge>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className={iconActionClasses(isSearchOpen)}
                onClick={() => setIsSearchOpen(!isSearchOpen)}
                aria-expanded={isSearchOpen}
                aria-label="Buscar conversas"
              >
                <Search className="h-4 w-4" aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Buscar por nome, telefone ou pet</TooltipContent>
          </Tooltip>

          {onToggleAutoRefresh && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className={iconActionClasses(autoRefresh)}
                  onClick={onToggleAutoRefresh}
                  aria-pressed={autoRefresh}
                  aria-label={
                    autoRefresh
                      ? 'Desativar atualização automática'
                      : 'Ativar atualização automática (30s)'
                  }
                >
                  <TimerReset className="h-4 w-4" aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {autoRefresh ? 'Atualização automática ativa (30s)' : 'Atualização automática (30s)'}
              </TooltipContent>
            </Tooltip>
          )}

          {onRefresh && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className={iconActionClasses()}
                  onClick={onRefresh}
                  disabled={isRefreshing}
                  aria-label="Atualizar lista"
                >
                  <RefreshCw
                    className={cn('h-4 w-4', isRefreshing && 'animate-spin')}
                    aria-hidden="true"
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {viewMode === 'groups' ? 'Atualizar grupos' : 'Atualizar conversas'}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Atribuídas ao atendente ativo x todas — somente com atendente escolhido */}
      {viewMode === 'chats' && atendenteAtivoNome && onAssignmentFilterChange && (
        <div
          className="mt-2 grid grid-cols-2 gap-0.5 rounded-lg border bg-card p-0.5"
          role="group"
          aria-label="Filtro de atribuição das conversas"
        >
          <button
            type="button"
            className={cn(
              'inline-flex h-7 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              assignmentFilter === 'atribuidas'
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
            onClick={() => onAssignmentFilterChange('atribuidas')}
            aria-pressed={assignmentFilter === 'atribuidas'}
            title={`Somente conversas atribuídas a ${atendenteAtivoNome}`}
          >
            <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Atribuídas
          </button>
          <button
            type="button"
            className={cn(
              'inline-flex h-7 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              assignmentFilter === 'todas'
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
            onClick={() => onAssignmentFilterChange('todas')}
            aria-pressed={assignmentFilter === 'todas'}
            title="Todas as conversas, atribuídas ou não"
          >
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            Todas
          </button>
        </div>
      )}

      {/* Linha 2: chips de filtro — somente na aba Conversas */}
      {viewMode === 'chats' && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {onToggleUnansweredFilter && (
            <button
              type="button"
              className={filterChipClasses(showOnlyUnanswered)}
              onClick={onToggleUnansweredFilter}
              aria-pressed={showOnlyUnanswered}
              title={showOnlyUnanswered ? 'Filtro "sem resposta" ativo — clique para desativar' : 'Mostrar somente conversas sem resposta'}
            >
              <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
              Sem resposta
            </button>
          )}
          {onTogglePausedFilter && (
            <button
              type="button"
              className={filterChipClasses(showOnlyPaused)}
              onClick={onTogglePausedFilter}
              aria-pressed={showOnlyPaused}
              title={showOnlyPaused ? 'Filtro "pausados" ativo — clique para desativar' : 'Mostrar somente bots pausados'}
            >
              <PauseCircle className="h-3.5 w-3.5" aria-hidden="true" />
              Pausados
            </button>
          )}
          {onTogglePendenciasFilter && (
            <button
              type="button"
              className={filterChipClasses(showOnlyPendencias)}
              onClick={onTogglePendenciasFilter}
              aria-pressed={showOnlyPendencias}
              title={showOnlyPendencias ? 'Filtro "com pendências" ativo — clique para desativar' : 'Mostrar somente clientes com pendências em aberto'}
            >
              <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
              Pendências
            </button>
          )}
          {onStatusFilterChange && (
            <Popover open={isStatusFilterOpen} onOpenChange={setIsStatusFilterOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={filterChipClasses(statusFilter !== 'todas')}
                  aria-pressed={statusFilter !== 'todas'}
                  title={
                    statusFilter !== 'todas'
                      ? `Filtro por status "${activeStatusOption.label}" ativo`
                      : 'Filtrar conversas por status (abertas, fechadas, arquivadas)'
                  }
                >
                  <ActiveStatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  {statusFilter !== 'todas' ? activeStatusOption.label : 'Status'}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-52 p-1" align="end">
                {STATUS_FILTER_OPTIONS.map(option => {
                  const OptionIcon = option.icon;
                  const isActive = statusFilter === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                      onClick={() => {
                        onStatusFilterChange(option.value);
                        setIsStatusFilterOpen(false);
                      }}
                    >
                      <OptionIcon
                        className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <span
                        className={cn(
                          'flex-1 truncate text-left',
                          option.value === 'todas' && 'text-muted-foreground'
                        )}
                      >
                        {option.label}
                      </span>
                      {isActive && <Check className="h-4 w-4 shrink-0 text-primary" />}
                    </button>
                  );
                })}
              </PopoverContent>
            </Popover>
          )}
          {onTagFilterChange && (
            <Popover open={isTagFilterOpen} onOpenChange={setIsTagFilterOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={filterChipClasses(tagFilterId !== null)}
                  aria-pressed={tagFilterId !== null}
                  title={activeTag ? `Filtro por tag "${activeTag.nome}" ativo` : 'Filtrar conversas por tag'}
                >
                  {activeTag ? (
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: activeTag.cor }}
                      aria-hidden="true"
                    />
                  ) : (
                    <TagIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  <span className="max-w-[90px] truncate">
                    {activeTag ? activeTag.nome : 'Tag'}
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-52 p-1" align="end">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                  onClick={() => {
                    onTagFilterChange(null);
                    setIsTagFilterOpen(false);
                  }}
                >
                  <span className="flex-1 text-left text-muted-foreground">Todas as conversas</span>
                  {tagFilterId === null && <Check className="h-4 w-4 text-primary" />}
                </button>
                {tags.length === 0 && (
                  <p className="px-2 py-1.5 text-xs text-muted-foreground">Nenhuma tag criada ainda.</p>
                )}
                {tags.map(tag => (
                  <button
                    key={tag.id}
                    type="button"
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                    onClick={() => {
                      onTagFilterChange(tag.id);
                      setIsTagFilterOpen(false);
                    }}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: tag.cor }}
                      aria-hidden="true"
                    />
                    <span className="flex-1 truncate text-left">{tag.nome}</span>
                    {tagFilterId === tag.id && <Check className="h-4 w-4 shrink-0 text-primary" />}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          )}
        </div>
      )}

      {isSearchOpen && (
        <div className="mt-2 flex gap-2">
          <Input
            placeholder={
              viewMode === 'groups'
                ? 'Buscar grupo por nome...'
                : 'Buscar por nome, telefone ou pet...'
            }
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className="h-8 flex-1"
            aria-label="Termo de busca de conversas"
            autoFocus
          />
          {searching && (
            <div
              className="flex h-8 items-center gap-1.5 text-xs text-muted-foreground"
              role="status"
              aria-live="polite"
            >
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span className="sr-only">Buscando em todas as conversas</span>
            </div>
          )}
          {searchTerm && (
            <Button
              size="sm"
              variant="outline"
              onClick={clearSearch}
              aria-label="Limpar busca"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default ConversationSubHeader;
