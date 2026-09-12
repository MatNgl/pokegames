// Pokedex des invites : la collection vit dans le navigateur (localStorage), faute de compte ou
// stocker les captures. Le jeton signe remis par le serveur a l'apparition est conserve avec
// l'entree : il sert de preuve de collecte pour consulter la fiche detaillee.
const STORAGE_KEY = 'pokegames:pokedex:guest';

export interface GuestPokedexEntry {
  id: number;
  pokedexId: number;
  nameFr: string;
  generation: number;
  token: string;
  collectedAt: string;
}

function isEntry(value: unknown): value is GuestPokedexEntry {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry['id'] === 'number' &&
    typeof entry['pokedexId'] === 'number' &&
    typeof entry['nameFr'] === 'string' &&
    typeof entry['generation'] === 'number' &&
    typeof entry['token'] === 'string' &&
    typeof entry['collectedAt'] === 'string'
  );
}

export function loadGuestCollection(): GuestPokedexEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
  } catch {
    // Stockage indisponible ou donnees corrompues : on repart d'une collection vide.
    return [];
  }
}

/** Ajoute une capture (idempotent sur l'identifiant) et renvoie la collection a jour. */
export function addGuestEntry(entry: GuestPokedexEntry): GuestPokedexEntry[] {
  const current = loadGuestCollection();
  const next = current.some((e) => e.id === entry.id) ? current : [...current, entry];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Stockage indisponible : la capture reste affichee pour la session en cours.
  }
  return next;
}

export function guestCollectedIds(entries: GuestPokedexEntry[]): Set<number> {
  return new Set(entries.map((e) => e.id));
}

export function guestTokenFor(entries: GuestPokedexEntry[], id: number): string | undefined {
  return entries.find((e) => e.id === id)?.token;
}

/** Jetons deja utilises : evite de reproposer une silhouette que l'invite a deja collectee. */
export function guestCollectedTokens(entries: GuestPokedexEntry[]): Set<string> {
  return new Set(entries.map((e) => e.token));
}
