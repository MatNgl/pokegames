/**
 * Generateur pseudo-aleatoire deterministe pour les series du jour (meme resultat pour tout le
 * monde, seede par la date UTC, parfois combinee a un niveau ou un mode).
 *
 * hashSeed seul garde des bits de poids faible correles entre chaines voisines : deux dates
 * consecutives ("2026-09-01" / "2026-09-02") ne produisaient qu'une graine differant d'une seule
 * unite, et un seul pas de LCG sur des graines aussi proches donnait des tirages quasi identiques
 * d'un jour a l'autre (Le Pokedex est reste bloque en Generation 1 plusieurs semaines d'affilee).
 * mix32 fait avalancher ce changement d'un caractere sur tous les bits avant de lancer le LCG.
 */

function hashSeed(str: string): number {
  let h = 7;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h || 1;
}

function mix32(value: number): number {
  let x = value >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  x = Math.imul(x, 0x7feb352d) >>> 0;
  x = (x ^ (x >>> 15)) >>> 0;
  x = Math.imul(x, 0x846ca68b) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}

function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/**
 * Generateur pseudo-aleatoire deterministe a partir d'une cle de chaine quelconque, typiquement
 * "<jeu>:<jour>" ou "<jeu>:<variante>:<jour>". Meme cle : meme suite de tirages, pour tous.
 */
export function seededRng(key: string): () => number {
  return makeRng(mix32(hashSeed(key)));
}

/** Date UTC du jour, au format AAAA-MM-JJ : cle de graine commune a tous les defis quotidiens. */
export function todayUtcDate(): string {
  return new Date().toISOString().split('T')[0] ?? '2026-01-01';
}
