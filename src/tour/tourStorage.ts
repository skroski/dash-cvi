/**
 * Marca quais tours a pessoa já concluiu, só para mostrar um ✓ no menu de ajuda.
 * Nada aqui dispara tour automaticamente — o tour só começa por clique.
 *
 * Segue a convenção de `src/utils/filterPreferences.ts`: chave versionada e
 * leitura tolerante a falha (modo privativo, storage cheio, JSON corrompido).
 */

const STORAGE_KEY = 'dash_cvi_tour_v1';

interface TourStorage {
  concluidos: string[];
}

const VAZIO: TourStorage = { concluidos: [] };

export function loadToursConcluidos(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return VAZIO.concluidos;
    const parsed = JSON.parse(raw) as Partial<TourStorage>;
    return Array.isArray(parsed.concluidos) ? parsed.concluidos : VAZIO.concluidos;
  } catch {
    return VAZIO.concluidos;
  }
}

export function marcarTourConcluido(tourId: string): string[] {
  const atuais = loadToursConcluidos();
  if (atuais.includes(tourId)) return atuais;
  const proximos = [...atuais, tourId];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ concluidos: proximos }));
  } catch {
    // Preferência cosmética: falhar em silêncio é melhor que quebrar o tour.
  }
  return proximos;
}

export function limparToursConcluidos(): string[] {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* idem */
  }
  return VAZIO.concluidos;
}
