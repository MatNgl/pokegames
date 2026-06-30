import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SpriteProxyService } from './sprite-proxy.service';
import { RedisService } from '../redis/redis.service';

describe('SpriteProxyService', () => {
  let service: SpriteProxyService;
  let mockSet: jest.Mock;
  let mockGet: jest.Mock;

  beforeEach(async () => {
    mockSet = jest.fn().mockResolvedValue(undefined);
    mockGet = jest.fn();

    const mockRedisService: Partial<RedisService> = {
      set: mockSet,
      get: mockGet,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpriteProxyService,
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    service = module.get<SpriteProxyService>(SpriteProxyService);
  });

  it('doit enregistrer une session de sprite dans Redis', async () => {
    await service.registerSpriteSession('hash-123', 25, 'https://example.com/25.png', 300);

    expect(mockSet).toHaveBeenCalledWith(
      'sprite_session:hash-123',
      JSON.stringify({
        pokemonId: 25,
        spriteUrl: 'https://example.com/25.png',
        isRevealed: false,
      }),
      300,
    );
  });

  it('doit marquer une session comme révélée lors du revealSpriteSession', async () => {
    mockGet.mockResolvedValue(
      JSON.stringify({
        pokemonId: 25,
        spriteUrl: 'https://example.com/25.png',
        isRevealed: false,
      }),
    );

    await service.revealSpriteSession('hash-123');

    expect(mockSet).toHaveBeenCalledWith(
      'sprite_session:hash-123',
      JSON.stringify({
        pokemonId: 25,
        spriteUrl: 'https://example.com/25.png',
        isRevealed: true,
      }),
      600,
    );
  });

  it('doit rejeter getSpriteBuffer si la session n’existe pas en cache', async () => {
    mockGet.mockResolvedValue(null);

    await expect(service.getSpriteBuffer('invalid-hash')).rejects.toThrow(NotFoundException);
  });
});
