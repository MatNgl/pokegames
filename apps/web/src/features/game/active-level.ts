import { useCallback, useState } from 'react';

// Niveau de jeu en cours, conservé le temps de l'onglet (sessionStorage) : un rafraîchissement de la
// page reprend le joueur sur son niveau (donc sur sa partie en cours, restaurée depuis localStorage)
// au lieu de le renvoyer à la sélection. Effacé au retour à la sélection. Repart à zéro à l'ouverture
// d'un nouvel onglet.
function storageKey(gameKey: string): string {
  return `active_level:${gameKey}`;
}

function loadActiveLevel<T extends string>(gameKey: string): T | null {
  try {
    return (sessionStorage.getItem(storageKey(gameKey)) as T | null) ?? null;
  } catch {
    return null;
  }
}

function saveActiveLevel(gameKey: string, level: string): void {
  try {
    sessionStorage.setItem(storageKey(gameKey), level);
  } catch {
    // sessionStorage indisponible (mode privé strict) : reprise impossible, sans incidence sur le jeu.
  }
}

function clearActiveLevel(gameKey: string): void {
  try {
    sessionStorage.removeItem(storageKey(gameKey));
  } catch {
    // Rien à nettoyer.
  }
}

/**
 * État du niveau actif d'un jeu, persistant au rafraîchissement (par onglet). Retourne le niveau
 * courant (restauré au montage), une fonction pour le choisir et une pour revenir à la sélection.
 */
export function useActiveLevel<T extends string>(gameKey: string): [T | null, (level: T) => void, () => void] {
  const [level, setLevel] = useState<T | null>(() => loadActiveLevel<T>(gameKey));
  const pick = useCallback(
    (next: T) => {
      saveActiveLevel(gameKey, next);
      setLevel(next);
    },
    [gameKey],
  );
  const reset = useCallback(() => {
    clearActiveLevel(gameKey);
    setLevel(null);
  }, [gameKey]);
  return [level, pick, reset];
}
