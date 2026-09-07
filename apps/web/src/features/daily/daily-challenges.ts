import { whoIsItDailyStatus } from '@/features/game/daily-storage';
import { motusDailyStatus } from '@/features/game/motus-storage';
import { plusMinusDailyStatus } from '@/features/game/plus-minus-storage';
import { intruderDailyStatus } from '@/features/game/intruder-storage';
import { shinyDailyStatus } from '@/features/game/shiny-storage';
import { trueShinyDailyStatus } from '@/features/game/true-shiny-storage';
import { justStatDailyStatus } from '@/features/game/just-stat-storage';
import { pokedexGameDailyStatus } from '@/features/game/pokedex-game-storage';

import whoIsItImg from '@/assets/games/who-is-it.png';
import pokeMotusImg from '@/assets/games/poke-motus.png';
import plusMinusImg from '@/assets/games/plus-minus.png';
import intrusImg from '@/assets/games/intrus.png';
import findShinyImg from '@/assets/games/find_shiny.png';
import findNotShinyImg from '@/assets/games/find_not_shiny.png';
import justPriceImg from '@/assets/games/just_price.png';
import leBonShinyImg from '@/assets/games/le_bon_shiny.png';
import lePokedexImg from '@/assets/games/le-pokedex.png';

export type LocalStatus = 'idle' | 'in-progress' | 'done';

export interface DailyChallenge {
  gameType: string;
  scope: string; // aligne sur le serveur (niveau, mode:niveau, ou vide)
  label: string; // libelle du sous-defi (niveau et/ou mode)
  route: string;
  localStatus: () => LocalStatus; // statut cote client (invites)
}

export interface DailyGameGroup {
  key: string; // identifiant unique du groupe (= gameType, sauf shiny scinde par mode)
  label: string; // libelle affiche dans les quetes
  gameType: string;
  route: string;
  iconImg: string;
  challenges: DailyChallenge[];
}

const LEVELS4 = ['FACILE', 'MOYEN', 'DIFFICILE', 'EXTREME'] as const;
const LEVELS3 = ['FACILE', 'MOYEN', 'DIFFICILE'] as const;
const LEVEL_LABEL: Record<string, string> = {
  FACILE: 'Facile',
  MOYEN: 'Moyen',
  DIFFICILE: 'Difficile',
  EXTREME: 'Extrême',
};

// Catalogue complet des defis quotidiens (jeu x niveau/mode). Source unique pour les quetes.
export const DAILY_GAME_GROUPS: DailyGameGroup[] = [
  {
    key: 'WHO_IS_IT',
    label: 'Quel est ce Pokémon',
    gameType: 'WHO_IS_IT',
    route: '/jouer',
    iconImg: whoIsItImg,
    challenges: LEVELS4.map((l) => ({
      gameType: 'WHO_IS_IT',
      scope: l,
      label: LEVEL_LABEL[l] ?? l,
      route: '/jouer',
      localStatus: () => whoIsItDailyStatus(l),
    })),
  },
  {
    key: 'MOTUS',
    label: 'Poké-Motus',
    gameType: 'MOTUS',
    route: '/motus',
    iconImg: pokeMotusImg,
    challenges: LEVELS4.map((l) => ({
      gameType: 'MOTUS',
      scope: l,
      label: LEVEL_LABEL[l] ?? l,
      route: '/motus',
      localStatus: () => motusDailyStatus(l),
    })),
  },
  {
    key: 'PLUS_MINUS',
    label: 'Plus ou Moins',
    gameType: 'PLUS_MINUS',
    route: '/plus-ou-moins',
    iconImg: plusMinusImg,
    challenges: LEVELS4.map((l) => ({
      gameType: 'PLUS_MINUS',
      scope: l,
      label: LEVEL_LABEL[l] ?? l,
      route: '/plus-ou-moins',
      localStatus: () => plusMinusDailyStatus(l),
    })),
  },
  {
    key: 'INTRUDER',
    label: "L'Intrus",
    gameType: 'INTRUDER',
    route: '/intrus',
    iconImg: intrusImg,
    challenges: LEVELS3.map((l) => ({
      gameType: 'INTRUDER',
      scope: l,
      label: LEVEL_LABEL[l] ?? l,
      route: '/intrus',
      localStatus: () => intruderDailyStatus(l),
    })),
  },
  // Trouve le shiny et Trouve le non-shiny : deux jeux distincts (vignettes et modes differents),
  // donc deux groupes de quetes separes, meme si le type serveur reste SHINY (scope par mode).
  {
    key: 'SHINY_FIND_SHINY',
    label: 'Trouve le shiny',
    gameType: 'SHINY',
    route: '/shiny',
    iconImg: findShinyImg,
    challenges: LEVELS3.map((l) => ({
      gameType: 'SHINY',
      scope: `FIND_SHINY:${l}`,
      label: LEVEL_LABEL[l] ?? l,
      route: '/shiny',
      localStatus: () => shinyDailyStatus('FIND_SHINY', l),
    })),
  },
  {
    key: 'SHINY_FIND_NON_SHINY',
    label: 'Trouve le non-shiny',
    gameType: 'SHINY',
    route: '/non-shiny',
    iconImg: findNotShinyImg,
    challenges: LEVELS3.map((l) => ({
      gameType: 'SHINY',
      scope: `FIND_NON_SHINY:${l}`,
      label: LEVEL_LABEL[l] ?? l,
      route: '/non-shiny',
      localStatus: () => shinyDailyStatus('FIND_NON_SHINY', l),
    })),
  },
  {
    key: 'TRUE_SHINY',
    label: 'Le Bon Shiny',
    gameType: 'TRUE_SHINY',
    route: '/bon-shiny',
    iconImg: leBonShinyImg,
    challenges: LEVELS3.map((l) => ({
      gameType: 'TRUE_SHINY',
      scope: l,
      label: LEVEL_LABEL[l] ?? l,
      route: '/bon-shiny',
      localStatus: () => trueShinyDailyStatus(l),
    })),
  },
  {
    key: 'JUST_STAT',
    label: 'La Juste Stat',
    gameType: 'JUST_STAT',
    route: '/juste-stat',
    iconImg: justPriceImg,
    challenges: [
      {
        gameType: 'JUST_STAT',
        scope: '',
        label: 'Défi du jour',
        route: '/juste-stat',
        localStatus: () => justStatDailyStatus(),
      },
    ],
  },
  {
    key: 'POKEDEX',
    label: 'Le Pokédex',
    gameType: 'POKEDEX',
    route: '/le-pokedex',
    iconImg: lePokedexImg,
    challenges: [
      {
        gameType: 'POKEDEX',
        scope: '',
        label: 'Défi du jour',
        route: '/le-pokedex',
        localStatus: () => pokedexGameDailyStatus(),
      },
    ],
  },
];

export const TOTAL_DAILY_CHALLENGES = DAILY_GAME_GROUPS.reduce(
  (sum, g) => sum + g.challenges.length,
  0,
);

export function challengeKey(gameType: string, scope: string): string {
  return `${gameType}:${scope}`;
}
