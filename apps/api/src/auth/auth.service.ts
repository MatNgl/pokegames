import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { UserDTO, RegisterRequest, LoginRequest } from '@pokegames/shared-types';

@Injectable()
export class AuthService {
  private readonly REFRESH_PREFIX = 'refresh_token:';
  private readonly REFRESH_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 jours

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
  ) {}

  async register(req: RegisterRequest): Promise<UserDTO> {
    if (!req.email || !req.username || !req.password) {
      throw new BadRequestException('Champs email, username et password requis');
    }

    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: req.email }, { username: req.username }],
      },
    });

    if (existingUser) {
      throw new ConflictException('Cet email ou ce nom d’utilisateur est déjà utilisé');
    }

    const passwordHash = await bcrypt.hash(req.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: req.email,
        username: req.username,
        passwordHash,
      },
    });

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      eloScore: user.eloScore,
      createdAt: user.createdAt,
    };
  }

  async login(req: LoginRequest): Promise<{ accessToken: string; refreshToken: string; user: UserDTO }> {
    if (!req.emailOrUsername || !req.password) {
      throw new BadRequestException('Identifiants incomplets');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: req.emailOrUsername }, { username: req.emailOrUsername }],
      },
    });

    if (!user) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    const isPasswordValid = await bcrypt.compare(req.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    const userDto: UserDTO = {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      eloScore: user.eloScore,
      createdAt: user.createdAt,
    };

    const accessToken = this.generateAccessToken(userDto);
    const refreshToken = uuidv4();

    await this.redisService.set(
      `${this.REFRESH_PREFIX}${refreshToken}`,
      user.id,
      this.REFRESH_TTL_SECONDS,
    );

    return { accessToken, refreshToken, user: userDto };
  }

  async refreshTokens(oldRefreshToken: string): Promise<{ accessToken: string; refreshToken: string; user: UserDTO }> {
    if (!oldRefreshToken) {
      throw new UnauthorizedException('Refresh token manquant');
    }

    const userId = await this.redisService.get(`${this.REFRESH_PREFIX}${oldRefreshToken}`);
    if (!userId) {
      throw new UnauthorizedException('Refresh token expiré ou invalide');
    }

    // Rotation du token : supprimer l'ancien
    await this.redisService.del(`${this.REFRESH_PREFIX}${oldRefreshToken}`);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('Utilisateur introuvable');
    }

    const userDto: UserDTO = {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      eloScore: user.eloScore,
      createdAt: user.createdAt,
    };

    const accessToken = this.generateAccessToken(userDto);
    const newRefreshToken = uuidv4();

    await this.redisService.set(
      `${this.REFRESH_PREFIX}${newRefreshToken}`,
      user.id,
      this.REFRESH_TTL_SECONDS,
    );

    return { accessToken, refreshToken: newRefreshToken, user: userDto };
  }

  async logout(refreshToken?: string): Promise<void> {
    if (refreshToken) {
      await this.redisService.del(`${this.REFRESH_PREFIX}${refreshToken}`);
    }
  }

  private generateAccessToken(user: UserDTO): string {
    return this.jwtService.sign(
      { sub: user.id, username: user.username, role: user.role },
      { expiresIn: '15m' },
    );
  }
}
