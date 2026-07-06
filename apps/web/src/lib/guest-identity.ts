// Identite invite persistee en localStorage : permet a un joueur non connecte d'apparaitre dans
// les classements du jour sous un pseudo stable (ex. "player_a3f9"), conserve d'un jour a l'autre
// sur le meme navigateur. L'id est un identifiant opaque, le nom est l'affichage public.
const GUEST_ID_KEY = 'pg_guest_id';
const GUEST_NAME_KEY = 'pg_guest_name';

export interface GuestIdentity {
  id: string;
  name: string;
}

function randomSuffix(): string {
  // 4 caracteres alphanumeriques minuscules, suffisant pour un affichage lisible.
  return Math.random().toString(36).slice(2, 6).padEnd(4, '0');
}

/**
 * Retourne l'identite invite du navigateur, en la creant au premier appel.
 * Le pseudo suit le format "player_xxxx" (le suffixe est partage avec l'id pour rester coherent).
 */
export function getGuestIdentity(): GuestIdentity {
  let id: string | null = null;
  let name: string | null = null;
  try {
    id = localStorage.getItem(GUEST_ID_KEY);
    name = localStorage.getItem(GUEST_NAME_KEY);
  } catch {
    // localStorage indisponible (mode prive strict) : identite ephemere, non persistee.
  }

  if (!id || !name) {
    const suffix = randomSuffix();
    id = id ?? `g_${suffix}${Math.random().toString(36).slice(2, 8)}`;
    name = name ?? `player_${suffix}`;
    try {
      localStorage.setItem(GUEST_ID_KEY, id);
      localStorage.setItem(GUEST_NAME_KEY, name);
    } catch {
      // Ecriture impossible : on garde l'identite en memoire pour la session courante.
    }
  }

  return { id, name };
}

/**
 * Efface l'identite invite du navigateur. Appele apres l'inscription : les scores invites sont
 * rattaches au compte cote serveur, l'ancien pseudo n'a plus lieu d'apparaitre. Un futur passage
 * en invite regenerera une identite neuve.
 */
export function clearGuestIdentity(): void {
  try {
    localStorage.removeItem(GUEST_ID_KEY);
    localStorage.removeItem(GUEST_NAME_KEY);
  } catch {
    // localStorage indisponible : rien a nettoyer.
  }
}
