import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface DailyPickInput {
  pokemonId?: number | null;
  detail?: string | null;
}

/**
 * Historique global des tirages quotidiens. Les defis etant deterministes et identiques pour
 * tous, l'historique est partage (pas par utilisateur). Il permet aux generateurs d'exclure les
 * Pokemon (ou les dimensions secondaires comme la stat tiree) deja sortis les jours precedents.
 *
 * Ce service est la brique de base : le branchement dans chaque generateur de jeu se fait dans une
 * etape dediee, en excluant recentPokemonIds/recentDetails puis en appelant recordPicks une fois
 * le tirage du jour fige.
 */
@Injectable()
export class HistoryService {
  constructor(private readonly prisma: PrismaService) {}

  /** Ramene une date a minuit UTC (les tirages sont indexes par jour calendaire UTC). */
  private utcDateOnly(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }

  /** Vrai si un tirage a deja ete enregistre pour ce jeu, ce scope et ce jour. */
  async hasPicksFor(game: string, scope: string, pickDate: Date): Promise<boolean> {
    const date = this.utcDateOnly(pickDate);
    const count = await this.prisma.dailyPick.count({ where: { game, scope, pickDate: date } });
    return count > 0;
  }

  /** Enregistre les tirages du jour (idempotence a gerer par l'appelant via hasPicksFor). */
  async recordPicks(
    game: string,
    scope: string,
    pickDate: Date,
    picks: DailyPickInput[],
  ): Promise<void> {
    if (picks.length === 0) return;
    const date = this.utcDateOnly(pickDate);
    await this.prisma.dailyPick.createMany({
      data: picks.map((pick) => ({
        game,
        scope,
        pickDate: date,
        pokemonId: pick.pokemonId ?? null,
        detail: pick.detail ?? null,
      })),
    });
  }

  /**
   * Identifiants de Pokemon sortis sur les `days` jours precedant `referenceDate` (jour de
   * reference exclu). A exclure du tirage du jour pour eviter les repetitions.
   */
  async recentPokemonIds(
    game: string,
    scope: string,
    referenceDate: Date,
    days: number,
  ): Promise<Set<number>> {
    const end = this.utcDateOnly(referenceDate);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - days);
    const rows = await this.prisma.dailyPick.findMany({
      where: { game, scope, pokemonId: { not: null }, pickDate: { gte: start, lt: end } },
      select: { pokemonId: true },
      distinct: ['pokemonId'],
    });
    const ids = new Set<number>();
    for (const row of rows) {
      if (row.pokemonId !== null) ids.add(row.pokemonId);
    }
    return ids;
  }

  /**
   * Dimensions secondaires (stat, critere...) sorties sur les `days` jours precedents, a raréfier
   * dans le tirage du jour.
   */
  async recentDetails(
    game: string,
    scope: string,
    referenceDate: Date,
    days: number,
  ): Promise<Set<string>> {
    const end = this.utcDateOnly(referenceDate);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - days);
    const rows = await this.prisma.dailyPick.findMany({
      where: { game, scope, detail: { not: null }, pickDate: { gte: start, lt: end } },
      select: { detail: true },
      distinct: ['detail'],
    });
    const details = new Set<string>();
    for (const row of rows) {
      if (row.detail !== null) details.add(row.detail);
    }
    return details;
  }
}
