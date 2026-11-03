import { useEffect, useRef, useState } from 'react';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Search,
  X,
  RefreshCw,
  PauseCircle,
  AlertCircle,
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
  Settings2,
  Bookmark,
  Pin,
  Trash2,
  Plus,
  FilterX,
  Sparkles,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ChatViewMode,
  Conversation,
  ConversationAssignmentFilter,
  ConversationStatusFilter,
} from '@/types/chat';
import { Tag } from '@/types/crm';
import {
  DEFAULT_CHIP_IDS,
  FilterChipId,
  FilterPreset,
  loadFilterPreferences,
  saveFilterPreferences,
  sortChips,
  UserFilterPreferences,
} from '@/utils/filterPreferences';
import { toast } from 'sonner';

export interface ChatFilterCounts {
  unanswered: number;
  paused: number;
  pendencias: number;
  byTag: Map<number, number>;
  byStatus: Record<ConversationStatusFilter, number>;
}

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
  showOnlyPaused?: boolean;
  onTogglePausedFilter?: () => void;
  showOnlyUnanswered?: boolean;
  onToggleUnansweredFilter?: () => void;
  showOnlyPendencias?: boolean;
  onTogglePendenciasFilter?: () => void;
  /** Definido pela rota: /chats (conversas) ou /groups (grupos). */
  viewMode?: ChatViewMode;
  /** Só na aba Grupos: mostra também os que a instância não faz mais parte. */
  showInactiveGroups?: boolean;
  onToggleInactiveGroupsFilter?: () => void;
  inactiveGroupsCount?: number;
  tagFilterId?: number | null;
  onTagFilterChange?: (tagId: number | null) => void;
  tags?: Tag[];
  statusFilter?: ConversationStatusFilter;
  onStatusFilterChange?: (status: ConversationStatusFilter) => void;
  assignmentFilter?: ConversationAssignmentFilter;
  onAssignmentFilterChange?: (filter: ConversationAssignmentFilter) => void;
  /** Nome do atendente ativo no painel; null oculta o filtro Atribuídas/Todas. */
  atendenteAtivoNome?: string | null;
  filterCounts?: ChatFilterCounts;
}

/** Chip de filtro compacto (pílula) — ativo ganha o tom do tema. */
const filterChipClasses = (active: boolean) =>
  cn(
    'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-all duration-200',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    active
      ? 'border-primary/40 bg-primary/10 text-primary shadow-xs hover:bg-primary/15'
      : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
  );

/** Botão de ação compacto (ícone) do topo da lista. */
const iconActionClasses = (active = false) =>
  cn(
    'h-8 w-8 transition-all duration-200',
    active && 'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary'
  );

const CHIP_LABELS: Record<FilterChipId, string> = {
  unanswered: 'Sem resposta',
  paused: 'Pausados',
  pendencias: 'Pendências',
  status: 'Status',
  tag: 'Tag',
};

const ConversationSubHeader = ({
  onSearchConversations,
  searchValue = '',
  conversationCount = 0,
  searching = false,
  onRefresh,
  isRefreshing = false,
  showOnlyPaused = false,
  onTogglePausedFilter,
  showOnlyUnanswered = false,
  onToggleUnansweredFilter,
  showOnlyPendencias = false,
  onTogglePendenciasFilter,
  viewMode = 'chats',
  showInactiveGroups = false,
  onToggleInactiveGroupsFilter,
  inactiveGroupsCount,
  tagFilterId = null,
  onTagFilterChange,
  tags = [],
  statusFilter = 'todas',
  onStatusFilterChange,
  assignmentFilter = 'todas',
  onAssignmentFilterChange,
  atendenteAtivoNome = null,
  filterCounts,
}: ConversationSubHeaderProps) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(searchValue);
  const [isTagFilterOpen, setIsTagFilterOpen] = useState(false);
  const [isStatusFilterOpen, setIsStatusFilterOpen] = useState(false);
  const [tagSearchTerm, setTagSearchTerm] = useState('');

  // Preferências personalizadas do usuário (localStorage)
  const [prefs, setPrefs] = useState<UserFilterPreferences>(loadFilterPreferences);
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');

  // Ref e estado de rolagem horizontal da barra de chips
  const chipsScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    const el = chipsScrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 3);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 3);
  };

  useEffect(() => {
    checkScroll();
    const el = chipsScrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkScroll);
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', checkScroll);
      ro.disconnect();
    };
  }, [prefs.visibleChips, viewMode, statusFilter, tagFilterId]);

  const scrollChips = (direction: 'left' | 'right') => {
    const el = chipsScrollRef.current;
    if (!el) return;
    const distance = 160;
    el.scrollBy({
      left: direction === 'left' ? -distance : distance,
      behavior: 'smooth',
    });
  };

  const activeTag = tagFilterId !== null ? tags.find((tag) => tag.id === tagFilterId) : undefined;
  const activeStatusOption =
    STATUS_FILTER_OPTIONS.find((option) => option.value === statusFilter) ?? STATUS_FILTER_OPTIONS[0];
  const ActiveStatusIcon = activeStatusOption.icon;

  const activeFilterCount =
    (showOnlyUnanswered ? 1 : 0) +
    (showOnlyPaused ? 1 : 0) +
    (showOnlyPendencias ? 1 : 0) +
    (tagFilterId !== null ? 1 : 0) +
    (statusFilter !== 'todas' ? 1 : 0) +
    (atendenteAtivoIdHasFilter(assignmentFilter, atendenteAtivoNome) ? 1 : 0);

  function atendenteAtivoIdHasFilter(
    filter: ConversationAssignmentFilter,
    nome: string | null
  ): boolean {
    return Boolean(nome && filter === 'atribuidas');
  }

  useEffect(() => {
    setSearchTerm(searchValue);
    if (searchValue) {
      setIsSearchOpen(true);
    }
  }, [searchValue]);

  // Atalho global Ctrl+K / / para busca
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  const handleClearAllFilters = () => {
    if (showOnlyUnanswered && onToggleUnansweredFilter) onToggleUnansweredFilter();
    if (showOnlyPaused && onTogglePausedFilter) onTogglePausedFilter();
    if (showOnlyPendencias && onTogglePendenciasFilter) onTogglePendenciasFilter();
    if (tagFilterId !== null && onTagFilterChange) onTagFilterChange(null);
    if (statusFilter !== 'todas' && onStatusFilterChange) onStatusFilterChange('todas');
    if (assignmentFilter === 'atribuidas' && onAssignmentFilterChange)
      onAssignmentFilterChange('todas');
    toast.success('Todos os filtros foram limpos');
  };

  const handleSavePreset = () => {
    const name = newPresetName.trim();
    if (!name) return;
    const newPreset: FilterPreset = {
      id: `preset_${Date.now()}`,
      name,
      state: {
        showOnlyUnanswered,
        showOnlyPaused,
        showOnlyPendencias,
        tagFilterId,
        statusFilter,
        assignmentFilter,
      },
      createdAt: Date.now(),
    };
    const updated = {
      ...prefs,
      savedPresets: [...prefs.savedPresets, newPreset],
    };
    setPrefs(updated);
    saveFilterPreferences(updated);
    setNewPresetName('');
    toast.success(`Visão "${name}" salva com sucesso!`);
  };

  const handleApplyPreset = (preset: FilterPreset) => {
    if (showOnlyUnanswered !== preset.state.showOnlyUnanswered && onToggleUnansweredFilter)
      onToggleUnansweredFilter();
    if (showOnlyPaused !== preset.state.showOnlyPaused && onTogglePausedFilter)
      onTogglePausedFilter();
    if (showOnlyPendencias !== preset.state.showOnlyPendencias && onTogglePendenciasFilter)
      onTogglePendenciasFilter();
    if (onTagFilterChange) onTagFilterChange(preset.state.tagFilterId);
    if (onStatusFilterChange) onStatusFilterChange(preset.state.statusFilter);
    if (onAssignmentFilterChange) onAssignmentFilterChange(preset.state.assignmentFilter);
    toast.success(`Visão "${preset.name}" aplicada`);
  };

  const handleDeletePreset = (id: string) => {
    const updated = {
      ...prefs,
      savedPresets: prefs.savedPresets.filter((p) => p.id !== id),
    };
    setPrefs(updated);
    saveFilterPreferences(updated);
    toast.success('Visão removida.');
  };

  const handleToggleChipVisibility = (chipId: FilterChipId) => {
    const isVisible = prefs.visibleChips.includes(chipId);
    const updatedChips = sortChips(
      isVisible
        ? prefs.visibleChips.filter((id) => id !== chipId)
        : [...prefs.visibleChips, chipId]
    );
    const updated = { ...prefs, visibleChips: updatedChips };
    setPrefs(updated);
    saveFilterPreferences(updated);
  };

  const visibleTags = tags
    .filter((tag) => tag.nome.toLowerCase().includes(tagSearchTerm.toLowerCase()));
  const stateUpdateLabel = isRefreshing
    ? viewMode === 'groups'
      ? 'Atualizando grupos...'
      : 'Atualizando conversas...'
    : searching
      ? viewMode === 'groups'
        ? 'Buscando grupos...'
        : 'Buscando conversas...'
      : null;

  return (
    <div className="border-b bg-muted/50 px-3 pb-2.5 pt-2 transition-all">
      {/* Linha 1: Título e contagem de conversas à esquerda + botões de ação à direita */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold truncate">
            {viewMode === 'groups' ? 'Grupos' : 'Conversas'}
                  </span>
          <Badge variant="secondary" className="tabular-nums transition-colors shrink-0">
            {conversationCount}
          </Badge>
          {stateUpdateLabel && (
            <span
              className="inline-flex h-5 w-5 items-center justify-center rounded-full border bg-background text-[11px] font-medium text-muted-foreground shadow-xs sm:w-auto sm:max-w-[150px] sm:justify-start sm:gap-1 sm:px-1.5"
              role="status"
              aria-live="polite"
            >
              <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden="true" />
              <span className="sr-only">{stateUpdateLabel}</span>
              <span className="hidden truncate sm:inline" aria-hidden="true">
                {stateUpdateLabel}
              </span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Presets / Personalização e Ações de Filtros */}
          {viewMode === 'chats' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className={cn(iconActionClasses(activeFilterCount > 0), 'relative')}
                  title="Configurações, visões salvas e filtros"
                  aria-label="Opções de visualização"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  {activeFilterCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground shadow-xs">
                      {activeFilterCount}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                {/* Opção de Limpar Filtros quando houver filtros ativos */}
                {activeFilterCount > 0 && (
                  <>
                    <DropdownMenuItem
                      onClick={handleClearAllFilters}
                      className="gap-2 text-xs font-semibold text-primary focus:bg-primary/10 transition-colors"
                    >
                      <FilterX className="h-3.5 w-3.5 text-primary" />
                      Limpar todos os filtros ({activeFilterCount})
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}

                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  Visões Salvas
                </div>
                {prefs.savedPresets.length === 0 ? (
                  <p className="px-2 py-1.5 text-xs text-muted-foreground">Nenhuma visão salva ainda.</p>
                ) : (
                  prefs.savedPresets.map((preset) => (
                    <DropdownMenuItem
                      key={preset.id}
                      className="flex items-center justify-between gap-2 text-xs"
                      onClick={() => handleApplyPreset(preset)}
                    >
                      <span className="truncate font-medium">{preset.name}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePreset(preset.id);
                        }}
                        className="text-muted-foreground hover:text-destructive"
                        title="Excluir visão"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuItem>
                  ))
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="gap-2 text-xs font-medium"
                  onClick={() => setIsCustomizeOpen(true)}
                >
                  <Settings2 className="h-3.5 w-3.5 text-primary" />
                  Personalizar Filtros...
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className={iconActionClasses(isSearchOpen)}
                onClick={() => setIsSearchOpen(!isSearchOpen)}
                aria-expanded={isSearchOpen}
                aria-label="Buscar conversas (Ctrl+K)"
              >
                <Search className="h-4 w-4" aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Buscar conversas (Ctrl+K)</TooltipContent>
          </Tooltip>

          {onRefresh && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className={iconActionClasses()}
                  onClick={onRefresh}
                  disabled={isRefreshing}
                  aria-busy={isRefreshing}
                  aria-label={isRefreshing ? 'Atualizando lista' : 'Atualizar lista'}
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

      {/* Grupos que a instância não faz mais parte: ocultos por padrão, sem valor pro atendimento */}
      {viewMode === 'groups' &&
        onToggleInactiveGroupsFilter &&
        (!!inactiveGroupsCount || showInactiveGroups) && (
        <div className="mt-2 flex items-center">
          <button
            type="button"
            className={filterChipClasses(showInactiveGroups)}
            onClick={onToggleInactiveGroupsFilter}
            aria-pressed={showInactiveGroups}
            title={
              showInactiveGroups
                ? 'Mostrando grupos que a instância não faz mais parte — clique para ocultar de novo'
                : 'Grupos que a instância não faz mais parte estão ocultos (sem mensagens novas possíveis) — clique para mostrar'
            }
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            Grupos que saímos
            {!!inactiveGroupsCount && (
              <span className="ml-0.5 rounded-full bg-muted/80 px-1.5 py-0.2 text-[10px] tabular-nums font-semibold">
                {inactiveGroupsCount}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Linha 2: chips de filtro em 1 linha com setas de rolagem em overflow */}
      {viewMode === 'chats' && (
        <div className="relative mt-2 flex items-center group/scroll" data-tour="chat-filter-chips">
          {canScrollLeft && (
            <div className="absolute left-0 top-0 bottom-0 z-20 flex items-center pr-5 pl-0.5 bg-gradient-to-r from-background via-background/90 to-transparent pointer-events-none">
              <Button
                size="icon"
                variant="outline"
                className="h-6.5 w-6.5 rounded-full bg-background shadow-md hover:bg-accent shrink-0 border border-border pointer-events-auto"
                onClick={() => scrollChips('left')}
                aria-label="Rolar filtros para esquerda"
                title="Ver mais filtros à esquerda"
              >
                <ChevronLeft className="h-3.5 w-3.5 text-foreground" />
              </Button>
            </div>
          )}

          <div
            ref={chipsScrollRef}
            className="flex flex-nowrap items-center gap-1.5 overflow-x-auto scroll-smooth w-full py-0.5 px-1"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {prefs.visibleChips.includes('tag') && onTagFilterChange && (
              <Popover open={isTagFilterOpen} onOpenChange={setIsTagFilterOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={filterChipClasses(tagFilterId !== null)}
                    aria-pressed={tagFilterId !== null}
                    title={
                      activeTag
                        ? `Filtro por tag "${activeTag.nome}" ativo`
                        : 'Filtrar conversas por tag'
                    }
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
                <PopoverContent className="w-60 p-1.5" align="end">
                  {/* Busca rápida de tags */}
                  <div className="mb-1 px-1">
                    <Input
                      placeholder="Buscar tag..."
                      value={tagSearchTerm}
                      onChange={(e) => setTagSearchTerm(e.target.value)}
                      className="h-7 text-xs"
                      autoFocus
                    />
                  </div>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                    onClick={() => {
                      onTagFilterChange(null);
                      setIsTagFilterOpen(false);
                      setTagSearchTerm('');
                    }}
                  >
                    <span className="flex-1 text-left text-muted-foreground">Todas as conversas</span>
                    {tagFilterId === null && <Check className="h-4 w-4 text-primary" />}
                  </button>
                  {visibleTags.length === 0 && (
                    <p className="px-2 py-1.5 text-xs text-muted-foreground">
                      {tagSearchTerm ? 'Nenhuma tag encontrada.' : 'Nenhuma tag criada ainda.'}
                    </p>
                  )}
                  {visibleTags.map((tag) => {
                    const tagCount = filterCounts?.byTag.get(tag.id) ?? 0;
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                        onClick={() => {
                          onTagFilterChange(tag.id);
                          setIsTagFilterOpen(false);
                          setTagSearchTerm('');
                        }}
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: tag.cor }}
                          aria-hidden="true"
                        />
                        <span className="flex-1 truncate text-left">{tag.nome}</span>
                        <span className="text-xs text-muted-foreground tabular-nums font-mono">
                          ({tagCount})
                        </span>
                        {tagFilterId === tag.id && <Check className="h-4 w-4 shrink-0 text-primary" />}
                      </button>
                    );
                  })}
                </PopoverContent>
              </Popover>
            )}

            {prefs.visibleChips.includes('pendencias') && onTogglePendenciasFilter && (
              <button
                type="button"
                className={filterChipClasses(showOnlyPendencias)}
                onClick={onTogglePendenciasFilter}
                aria-pressed={showOnlyPendencias}
                title={
                  showOnlyPendencias
                    ? 'Filtro "com pendências" ativo — clique para desativar'
                    : 'Mostrar somente clientes com pendências em aberto'
                }
              >
                <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
                Pendências
                {filterCounts && (
                  <span className="ml-0.5 rounded-full bg-muted/80 px-1.5 py-0.2 text-[10px] tabular-nums font-semibold">
                    {filterCounts.pendencias}
                  </span>
                )}
              </button>
            )}

            {prefs.visibleChips.includes('status') && onStatusFilterChange && (
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
                <PopoverContent className="w-56 p-1" align="end">
                  {STATUS_FILTER_OPTIONS.map((option) => {
                    const OptionIcon = option.icon;
                    const isActive = statusFilter === option.value;
                    const count = filterCounts ? filterCounts.byStatus[option.value] ?? 0 : undefined;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent transition-colors"
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
                        {count !== undefined && (
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {count}
                          </span>
                        )}
                        {isActive && <Check className="h-4 w-4 shrink-0 text-primary" />}
                      </button>
                    );
                  })}
                </PopoverContent>
              </Popover>
            )}

            {prefs.visibleChips.includes('unanswered') && onToggleUnansweredFilter && (
              <button
                type="button"
                className={filterChipClasses(showOnlyUnanswered)}
                onClick={onToggleUnansweredFilter}
                aria-pressed={showOnlyUnanswered}
                title={
                  showOnlyUnanswered
                    ? 'Filtro "sem resposta" ativo — clique para desativar'
                    : 'Mostrar somente conversas sem resposta'
                }
              >
                <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                Sem resposta
                {filterCounts && (
                  <span className="ml-0.5 rounded-full bg-muted/80 px-1.5 py-0.2 text-[10px] tabular-nums font-semibold">
                    {filterCounts.unanswered}
                  </span>
                )}
              </button>
            )}

            {prefs.visibleChips.includes('paused') && onTogglePausedFilter && (
              <button
                type="button"
                className={filterChipClasses(showOnlyPaused)}
                onClick={onTogglePausedFilter}
                aria-pressed={showOnlyPaused}
                title={
                  showOnlyPaused
                    ? 'Filtro "pausados" ativo — clique para desativar'
                    : 'Mostrar somente bots pausados'
                }
              >
                <PauseCircle className="h-3.5 w-3.5" aria-hidden="true" />
                Pausados
                {filterCounts && (
                  <span className="ml-0.5 rounded-full bg-muted/80 px-1.5 py-0.2 text-[10px] tabular-nums font-semibold">
                    {filterCounts.paused}
                  </span>
                )}
              </button>
            )}
          </div>

          {canScrollRight && (
            <div className="absolute right-0 top-0 bottom-0 z-20 flex items-center pl-5 pr-0.5 bg-gradient-to-l from-background via-background/90 to-transparent pointer-events-none">
              <Button
                size="icon"
                variant="outline"
                className="h-6.5 w-6.5 rounded-full bg-background shadow-md hover:bg-accent shrink-0 border border-border pointer-events-auto"
                onClick={() => scrollChips('right')}
                aria-label="Rolar filtros para direita"
                title="Ver mais filtros à direita"
              >
                <ChevronRight className="h-3.5 w-3.5 text-foreground" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Input de busca expansível com feedback visual */}
      {isSearchOpen && (
        <div className="mt-2 flex gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
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
              <span className="hidden sm:inline">Buscando...</span>
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

      {/* Modal de Personalização dos Filtros e Salvar Visões */}
      <Dialog open={isCustomizeOpen} onOpenChange={setIsCustomizeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Personalizar Filtros da Lista</DialogTitle>
            <DialogDescription>
              Escolha quais chips deseja visualizar e salve visões personalizadas para acesso rápido.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Salvar Visão Atual */}
            <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
              <label className="text-xs font-semibold text-foreground">Salvar Visão Atual (Preset)</label>
              <div className="flex gap-2">
                <Input
                  placeholder="Nome da visão (ex: Minhas Estética)"
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  className="h-8 text-xs"
                />
                <Button size="sm" onClick={handleSavePreset} disabled={!newPresetName.trim()}>
                  <Bookmark className="mr-1 h-3.5 w-3.5" />
                  Salvar
                </Button>
              </div>
            </div>

            {/* Chips Visíveis */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">Chips Visíveis na Barra</label>
              <div className="grid grid-cols-2 gap-2">
                {DEFAULT_CHIP_IDS.map((chipId) => {
                  const isChecked = prefs.visibleChips.includes(chipId);
                  return (
                    <button
                      key={chipId}
                      type="button"
                      onClick={() => handleToggleChipVisibility(chipId)}
                      className={cn(
                        'flex items-center justify-between rounded-md border p-2 text-xs font-medium transition-colors',
                        isChecked ? 'border-primary/50 bg-primary/10 text-primary' : 'bg-card text-muted-foreground'
                      )}
                    >
                      <span>{CHIP_LABELS[chipId]}</span>
                      {isChecked && <Check className="h-4 w-4" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ConversationSubHeader;
