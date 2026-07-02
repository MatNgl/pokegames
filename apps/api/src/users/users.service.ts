import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { UserDTO, PlayerHistoryItem } from '@pokegames/shared-types';

@Injectable()
export class UsersService {
  private readonly onlineClients = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly redis?: RedisService,
  ) {}

  async getProfile(userId: string): Promise<UserDTO> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      createdAt: user.createdAt,
    };
  }

  async getPlayerHistory(userId: string, limit = 20): Promise<PlayerHistoryItem[]> {
    const history = await this.prisma.gameHistory.findMany({
      where: { userId },
      orderBy: { playedAt: 'desc' },
      take: Math.min(limit, 100),
    });

    return history.map((item) => ({
      id: item.id,
      gameType: item.gameType as PlayerHistoryItem['gameType'],
      score: item.score,
      playedAt: item.playedAt,
      isMulti: item.isMulti,
    }));
  }

  async recordOnlinePlayer(clientId: string): Promise<number> {
    const now = Date.now();
    this.onlineClients.set(clientId, now);
    for (const [id, lastSeen] of this.onlineClients.entries()) {
      if (now - lastSeen > 180_000) {
        this.onlineClients.delete(id);
      }
    }

    if (this.redis) {
      try {
        const client = this.redis.getClient();
        await client.zadd('pokegames:online:players', now, clientId);
        await client.zremrangebyscore('pokegames:online:players', '-inf', now - 180_000);
        const redisCount = await client.zcard('pokegames:online:players');
        return Math.max(redisCount, this.onlineClients.size, 1);
      } catch {
        // Ignorer si Redis n'est pas disponible en local
      }
    }

    return Math.max(this.onlineClients.size, 1);
  }
}
