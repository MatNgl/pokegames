import { whoIsItDailyStatus } from '@/features/game/daily-storage';
import { motusDailyStatus } from '@/features/game/motus-storage';
import { plusMinusDailyStatus } from '@/features/game/plus-minus-storage';
import { intruderDailyStatus } from '@/features/game/intruder-storage';
import { shinyDailyStatus } from '@/features/game/shiny-storage';
import { trueShinyDailyStatus } from '@/features/game/true-shiny-storage';
import { justStatDailyStatus } from '@/features/game/just-stat-storage';

export type LocalStatus = 'idle' | 'in-progress' | 'done';

export interface DailyChallenge {
  gameType: string;
  scope: string; // aligne sur le serveur (niveau, mode:niveau, ou vide)
  label: string; // libelle du sous-defi (niveau et/ou mode)
  route: string;
  localStatus: () => LocalStatus; // statut cote client (invites)
}

export interface DailyGameGroup {
  gameType: string;
  route: string;
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
    gameType: 'WHO_IS_IT',
    route: '/jouer',
    challenges: LEVELS4.map((l) => ({
      gameType: 'WHO_IS_IT',
      scope: l,
      label: LEVEL_LABEL[l] ?? l,
      route: '/jouer',
      localStatus: () => whoIsItDailyStatus(l),
    })),
  },
  {
    gameType: 'MOTUS',
    route: '/motus',
    challenges: LEVELS4.map((l) => ({
      gameType: 'MOTUS',
      scope: l,
      label: LEVEL_LABEL[l] ?? l,
      route: '/motus',
      localStatus: () => motusDailyStatus(l),
    })),
  },
  {
    gameType: 'PLUS_MINUS',
    route: '/plus-ou-moins',
    challenges: LEVELS4.map((l) => ({
      gameType: 'PLUS_MINUS',
      scope: l,
      label: LEVEL_LABEL[l] ?? l,
      route: '/plus-ou-moins',
      localStatus: () => plusMinusDailyStatus(l),
    })),
  },
  {
    gameType: 'INTRUDER',
    route: '/intrus',
    challenges: LEVELS3.map((l) => ({
      gameType: 'INTRUDER',
      scope: l,
      label: LEVEL_LABEL[l] ?? l,
      route: '/intrus',
      localStatus: () => intruderDailyStatus(l),
    })),
  },
  {
    gameType: 'SHINY',
    route: '/shiny',
    challenges: [
      ...LEVELS3.map((l) => ({
        gameType: 'SHINY',
        scope: `FIND_SHINY:${l}`,
        label: `Shiny · ${LEVEL_LABEL[l] ?? l}`,
        route: '/shiny',
        localStatus: () => shinyDailyStatus('FIND_SHINY', l),
      })),
      ...LEVELS3.map((l) => ({
        gameType: 'SHINY',
        scope: `FIND_NON_SHINY:${l}`,
        label: `Non-Shiny · ${LEVEL_LABEL[l] ?? l}`,
        route: '/non-shiny',
        localStatus: () => shinyDailyStatus('FIND_NON_SHINY', l),
      })),
    ],
  },
  {
    gameType: 'TRUE_SHINY',
    route: '/bon-shiny',
    challenges: LEVELS3.map((l) => ({
      gameType: 'TRUE_SHINY',
      scope: l,
      label: LEVEL_LABEL[l] ?? l,
      route: '/bon-shiny',
      localStatus: () => trueShinyDailyStatus(l),
    })),
  },
  {
    gameType: 'JUST_STAT',
    route: '/juste-stat',
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
];

export const TOTAL_DAILY_CHALLENGES = DAILY_GAME_GROUPS.reduce(
  (sum, g) => sum + g.challenges.length,
  0,
);

export function challengeKey(gameType: string, scope: string): string {
  return `${gameType}:${scope}`;
}
