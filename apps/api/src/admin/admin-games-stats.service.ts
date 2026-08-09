import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createdAtFilter, median, pct, periodStart } from './admin-period';
import type {
  AdminAttemptsDistribution,
  AdminCompletion,
  AdminGamesReport,
  AdminHintUsage,
  AdminLevelDifficulty,
  AdminPokemonDifficulty,
} from '@pokegames/shared-types';

// Un Pokemon doit avoir ete propose au moins ce nombre de fois pour figurer dans les classements :
// en dessous, un « 0 % de reussite » sur une seule partie ne veut rien dire.
const MIN_PLAYS_FOR_RANKING = 3;
// Jeux dont le nombre d'essais est la metrique de score (histogramme pertinent).
const ATTEMPT_BASED_GAMES = ['WHO_IS_IT', 'MOTUS'];

/**
 * Rapport d'equilibrage : difficulte reelle par niveau, Pokemon les plus durs, distribution des
 * essais, usage des indices et completion des defis. Sert a regler le jeu, pas a surveiller.
 */
@Injectable()
export class AdminGamesStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getReport(days: number, now = new Date()): Promise<AdminGamesReport> {
    const start = periodStart(days, now);
    const [logs, results, pokemons] = await Promise.all([
      this.prisma.gameAuditLog.findMany({
        where: createdAtFilter(days, now),
        select: {
          gameType: true,
          targetPokemonId: true,
          targetNameFr: true,
          isSuccess: true,
          durationSeconds: true,
          hintsUsedCount: true,
        },
      }),
      this.prisma.dailyResult.findMany({
        where: start ? { dayDate: { gte: start } } : {},
        select: {
          gameType: true,
          scope: true,
          won: true,
          attempts: true,
          correctCount: true,
          totalRounds: true,
          durationSeconds: true,
        },
      }),
      this.prisma.pokemon.findMany({ select: { id: true, nameFr: true } }),
    ]);
    const nameById = new Map(pokemons.map((p) => [p.id, p.nameFr]));

    return {
      levels: this.levels(results),
      hardestPokemon: this.pokemonRanking(logs, nameById, 'hardest'),
      easiestPokemon: this.pokemonRanking(logs, nameById, 'easiest'),
      attempts: this.attempts(results),
      hints: this.hints(logs),
      completion: this.completion(results),
    };
  }

  /**
   * B1 : difficulte reelle par jeu x niveau, calculee sur les defis quotidiens termines (c'est la
   * seule table qui porte le niveau, GameAuditLog ne l'enregistre pas).
   */
  private levels(
    results: {
      gameType: string;
      scope: string;
      won: boolean;
      attempts: number | null;
      correctCount: number | null;
      totalRounds: number | null;
      durationSeconds: number | null;
    }[],
  ): AdminLevelDifficulty[] {
    const groups = new Map<string, typeof results>();
    for (const r of results) {
      const key = `${r.gameType}|${r.scope}`;
      const list = groups.get(key) ?? [];
      list.push(r);
      groups.set(key, list);
    }

    return [...groups.entries()]
      .map(([key, rows]) => {
        const [gameType, scope] = key.split('|');
        // Reussite : le ratio bonnes reponses quand il existe, sinon le drapeau « gagne ».
        const withCount = rows.filter((r) => r.correctCount != null && r.totalRounds);
        const successRatePct = withCount.length
          ? pct(
              withCount.reduce((s, r) => s + (r.correctCount ?? 0), 0),
              withCount.reduce((s, r) => s + (r.totalRounds ?? 0), 0),
            )
          : pct(rows.filter((r) => r.won).length, rows.length);
        const attempts = rows.map((r) => r.attempts).filter((a): a is number => a != null);
        return {
          gameType: gameType ?? '',
          scope: scope ?? '',
          played: rows.length,
          successRatePct,
          medianDurationSeconds: median(
            rows.map((r) => r.durationSeconds).filter((d): d is number => d != null),
          ),
          avgAttempts: attempts.length
            ? Math.round((attempts.reduce((s, a) => s + a, 0) / attempts.length) * 10) / 10
            : null,
        };
      })
      .sort((a, b) =>
        a.gameType === b.gameType ? a.scope.localeCompare(b.scope) : a.gameType.localeCompare(b.gameType),
      );
  }

  /** B2 : Pokemon les plus rates et les plus trouves, au-dela d'un seuil de parties. */
  private pokemonRanking(
    logs: { targetPokemonId: number; targetNameFr: string; isSuccess: boolean }[],
    nameById: Map<number, string>,
    mode: 'hardest' | 'easiest',
  ): AdminPokemonDifficulty[] {
    const byPokemon = new Map<number, { played: number; won: number; name: string }>();
    for (const l of logs) {
      const cur = byPokemon.get(l.targetPokemonId) ?? {
        played: 0,
        won: 0,
        name: nameById.get(l.targetPokemonId) ?? l.targetNameFr,
      };
      cur.played += 1;
      if (l.isSuccess) cur.won += 1;
      byPokemon.set(l.targetPokemonId, cur);
    }

    const rows = [...byPokemon.entries()]
      .filter(([, v]) => v.played >= MIN_PLAYS_FOR_RANKING)
      .map(([pokemonId, v]) => ({
        pokemonId,
        nameFr: v.name,
        played: v.played,
        successRatePct: pct(v.won, v.played),
      }));

    rows.sort((a, b) =>
      mode === 'hardest'
        ? a.successRatePct - b.successRatePct || b.played - a.played
        : b.successRatePct - a.successRatePct || b.played - a.played,
    );
    return rows.slice(0, 10);
  }

  /** B3 : histogramme du nombre d'essais, pour les jeux ou l'essai est la metrique. */
  private attempts(
    results: { gameType: string; attempts: number | null }[],
  ): AdminAttemptsDistribution[] {
    return ATTEMPT_BASED_GAMES.map((gameType) => {
      const values = results
        .filter((r) => r.gameType === gameType && r.attempts != null)
        .map((r) => r.attempts as number);
      const counts = new Map<number, number>();
      for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
      return {
        gameType,
        buckets: [...counts.entries()]
          .map(([attempts, count]) => ({ attempts, count }))
          .sort((a, b) => a.attempts - b.attempts),
      };
    }).filter((d) => d.buckets.length > 0);
  }

  /** B4 : usage des indices et effet mesure sur la reussite. */
  private hints(
    logs: { gameType: string; hintsUsedCount: number; isSuccess: boolean }[],
  ): AdminHintUsage[] {
    const groups = new Map<string, typeof logs>();
    for (const l of logs) {
      const list = groups.get(l.gameType) ?? [];
      list.push(l);
      groups.set(l.gameType, list);
    }
    return [...groups.entries()]
      .map(([gameType, rows]) => {
        const withHints = rows.filter((r) => r.hintsUsedCount > 0);
        const withoutHints = rows.filter((r) => r.hintsUsedCount === 0);
        return {
          gameType,
          avgHints:
            Math.round((rows.reduce((s, r) => s + r.hintsUsedCount, 0) / rows.length) * 100) / 100,
          successWithHintsPct: withHints.length
            ? pct(withHints.filter((r) => r.isSuccess).length, withHints.length)
            : null,
          successWithoutHintsPct: withoutHints.length
            ? pct(withoutHints.filter((r) => r.isSuccess).length, withoutHints.length)
            : null,
        };
      })
      .filter((h) => h.avgHints > 0)
      .sort((a, b) => b.avgHints - a.avgHints);
  }

  /** B5 : defis quotidiens menes a terme et part de reussite, par jeu et niveau. */
  private completion(results: { gameType: string; scope: string; won: boolean }[]): AdminCompletion[] {
    const groups = new Map<string, { completed: number; won: number }>();
    for (const r of results) {
      const key = `${r.gameType}|${r.scope}`;
      const cur = groups.get(key) ?? { completed: 0, won: 0 };
      cur.completed += 1;
      if (r.won) cur.won += 1;
      groups.set(key, cur);
    }
    return [...groups.entries()]
      .map(([key, v]) => {
        const [gameType, scope] = key.split('|');
        return {
          gameType: gameType ?? '',
          scope: scope ?? '',
          completed: v.completed,
          won: v.won,
          wonPct: pct(v.won, v.completed),
        };
      })
      .sort((a, b) => b.completed - a.completed);
  }
}
