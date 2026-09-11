import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { pct } from './admin-period';
import type { AdminPokedexReport, AdminSystemInfo, AdminZoneCollect } from '@pokegames/shared-types';

/**
 * Rapports Pokedex et etat des donnees.
 *
 * Le taux de collecte par zone est l'indicateur utile : une zone ou les silhouettes apparaissent
 * mais ne sont jamais ramassees signale un ecran peu visite, ou une silhouette mal placee.
 */
@Injectable()
export class AdminPokedexStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getReport(): Promise<AdminPokedexReport> {
    const [spawns, totalSpecies, entries, collectors, totalUsers] = await Promise.all([
      this.prisma.pokedexSpawn.groupBy({
        by: ['zone', 'collected'],
        _count: { _all: true },
      }),
      this.prisma.pokemon.count(),
      this.prisma.userPokedexEntry.count(),
      this.prisma.userPokedexEntry.findMany({ select: { userId: true }, distinct: ['userId'] }),
      this.prisma.user.count(),
    ]);

    const byZone = new Map<string, { spawned: number; collected: number }>();
    for (const row of spawns) {
      const cur = byZone.get(row.zone) ?? { spawned: 0, collected: 0 };
      cur.spawned += row._count._all;
      if (row.collected) cur.collected += row._count._all;
      byZone.set(row.zone, cur);
    }
    const zones: AdminZoneCollect[] = [...byZone.entries()]
      .map(([zone, v]) => ({
        zone,
        spawned: v.spawned,
        collected: v.collected,
        ratePct: pct(v.collected, v.spawned),
      }))
      .sort((a, b) => a.ratePct - b.ratePct);

    const collectorCount = collectors.length;
    const avgCollected = collectorCount > 0 ? entries / collectorCount : 0;

    return {
      zones,
      avgCollected: Math.round(avgCollected * 10) / 10,
      avgPct: totalSpecies > 0 ? Math.round((avgCollected / totalSpecies) * 1000) / 10 : 0,
      totalSpecies,
      collectors: collectorCount,
      collectorsPct: pct(collectorCount, totalUsers),
    };
  }

  /** Etat du catalogue et tirages du jour (onglet Systeme). */
  async getSystemInfo(now = new Date()): Promise<AdminSystemInfo> {
    const dayDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const [pokemonCount, withShinySprite, withMega, latest, picks] = await Promise.all([
      this.prisma.pokemon.count(),
      this.prisma.pokemon.count({ where: { spriteShiny: { not: null } } }),
      this.prisma.pokemon.count({ where: { hasMega: true } }),
      this.prisma.pokemon.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
      this.prisma.dailyPick.groupBy({
        by: ['game', 'scope'],
        where: { pickDate: dayDate },
        _count: { _all: true },
      }),
    ]);

    return {
      pokemonCount,
      withShinySprite,
      withMega,
      lastPokemonUpdate: latest?.updatedAt ? latest.updatedAt.toISOString() : null,
      todayPicks: picks
        .map((p) => ({ game: p.game, scope: p.scope, count: p._count._all }))
        .sort((a, b) => a.game.localeCompare(b.game) || a.scope.localeCompare(b.scope)),
    };
  }
}
