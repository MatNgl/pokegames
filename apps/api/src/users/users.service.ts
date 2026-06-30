import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserDTO, PlayerHistoryItem } from '@pokegames/shared-types';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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
      eloScore: user.eloScore,
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

  async getLeaderboard(limit = 10): Promise<UserDTO[]> {
    const topUsers = await this.prisma.user.findMany({
      orderBy: { eloScore: 'desc' },
      take: Math.min(limit, 50),
    });

    return topUsers.map((user) => ({
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      eloScore: user.eloScore,
      createdAt: user.createdAt,
    }));
  }
}
