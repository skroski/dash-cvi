import { ConversationAssignmentFilter, ConversationStatusFilter } from '@/types/chat';

export type FilterChipId = 'tag' | 'pendencias' | 'status' | 'unanswered' | 'paused';

export interface FilterPresetState {
  showOnlyUnanswered: boolean;
  showOnlyPaused: boolean;
  showOnlyPendencias: boolean;
  tagFilterId: number | null;
  statusFilter: ConversationStatusFilter;
  assignmentFilter: ConversationAssignmentFilter;
}

export interface FilterPreset {
  id: string;
  name: string;
  state: FilterPresetState;
  createdAt: number;
}

export interface UserFilterPreferences {
  visibleChips: FilterChipId[];
  defaultPresetId?: string | null;
  savedPresets: FilterPreset[];
}

const STORAGE_KEY = 'dash_cvi_chat_filter_preferences_v1';

export const DEFAULT_CHIP_IDS: FilterChipId[] = [
  'tag',
  'pendencias',
  'status',
  'unanswered',
  'paused',
];

export function sortChips(chips: FilterChipId[]): FilterChipId[] {
  return [...chips].sort(
    (a, b) => DEFAULT_CHIP_IDS.indexOf(a) - DEFAULT_CHIP_IDS.indexOf(b)
  );
}

export const DEFAULT_PREFERENCES: UserFilterPreferences = {
  visibleChips: DEFAULT_CHIP_IDS,
  defaultPresetId: null,
  savedPresets: [],
};

export function loadFilterPreferences(): UserFilterPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw);
    const visibleChips = Array.isArray(parsed.visibleChips) ? parsed.visibleChips : DEFAULT_CHIP_IDS;
    return {
      visibleChips: sortChips(visibleChips),
      defaultPresetId: parsed.defaultPresetId ?? null,
      savedPresets: Array.isArray(parsed.savedPresets) ? parsed.savedPresets : [],
    };
  } catch (err) {
    console.error('Erro ao carregar preferências de filtro:', err);
    return DEFAULT_PREFERENCES;
  }
}

export function saveFilterPreferences(prefs: UserFilterPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch (err) {
    console.error('Erro ao salvar preferências de filtro:', err);
  }
}
