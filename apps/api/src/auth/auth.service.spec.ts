import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

jest.mock('bcrypt');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('AuthService', () => {
  let service: AuthService;
  let mockPrismaFindFirst: jest.Mock;
  let mockPrismaCreate: jest.Mock;
  let mockPrismaFindUnique: jest.Mock;
  let mockJwtSign: jest.Mock;
  let mockRedisSet: jest.Mock;
  let mockRedisGet: jest.Mock;
  let mockRedisDel: jest.Mock;

  beforeEach(async () => {
    mockPrismaFindFirst = jest.fn();
    mockPrismaCreate = jest.fn();
    mockPrismaFindUnique = jest.fn();
    mockJwtSign = jest.fn().mockReturnValue('access-token-123');
    mockRedisSet = jest.fn().mockResolvedValue(undefined);
    mockRedisGet = jest.fn();
    mockRedisDel = jest.fn().mockResolvedValue(undefined);

    const mockPrismaService = {
      user: {
        findFirst: mockPrismaFindFirst,
        create: mockPrismaCreate,
        findUnique: mockPrismaFindUnique,
      },
    };

    const mockJwtService = { sign: mockJwtSign };
    const mockRedisService = { set: mockRedisSet, get: mockRedisGet, del: mockRedisDel };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('doit être défini', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('doit créer un utilisateur en hachant le mot de passe', async () => {
      mockPrismaFindFirst.mockResolvedValue(null);
      mockedBcrypt.hash.mockImplementation(async () => 'hashed-pwd');
      mockPrismaCreate.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'sacha',
        role: 'USER',
        createdAt: new Date(),
      });

      const res = await service.register({
        email: 'test@example.com',
        username: 'sacha',
        password: 'Password123!',
      });

      expect(res.id).toBe('user-1');
      expect(mockedBcrypt.hash).toHaveBeenCalledWith('Password123!', 10);
      expect(mockPrismaCreate).toHaveBeenCalled();
    });

    it('doit lever une exception si l’email ou l’username existe déjà', async () => {
      mockPrismaFindFirst.mockResolvedValue({ id: 'existing-user' });

      await expect(
        service.register({ email: 'test@example.com', username: 'sacha', password: 'pwd' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('doit renvoyer un access token et un refresh token en cache Redis', async () => {
      mockPrismaFindFirst.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'sacha',
        passwordHash: 'hashed-pwd',
        role: 'USER',
        createdAt: new Date(),
      });
      mockedBcrypt.compare.mockImplementation(async () => true);

      const res = await service.login({ emailOrUsername: 'sacha', password: 'Password123!' });

      expect(res.accessToken).toBe('access-token-123');
      expect(res.refreshToken).toBeDefined();
      expect(mockRedisSet).toHaveBeenCalledWith(
        expect.stringContaining('refresh_token:'),
        'user-1',
        604800,
      );
    });

    it('doit lever UnauthorizedException en cas de mauvais mot de passe', async () => {
      mockPrismaFindFirst.mockResolvedValue({
        id: 'user-1',
        passwordHash: 'hashed-pwd',
      });
      mockedBcrypt.compare.mockImplementation(async () => false);

      await expect(
        service.login({ emailOrUsername: 'sacha', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshTokens', () => {
    it('doit effectuer une rotation du refresh token et renvoyer un nouveau token d’accès', async () => {
      mockRedisGet.mockResolvedValue('user-1');
      mockPrismaFindUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'sacha',
        role: 'USER',
      });

      const res = await service.refreshTokens('old-refresh-token');

      expect(mockRedisDel).toHaveBeenCalledWith('refresh_token:old-refresh-token');
      expect(res.accessToken).toBe('access-token-123');
      expect(res.refreshToken).not.toBe('old-refresh-token');
    });
  });
});
