import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import axios from 'axios';
import { SpriteProxyService } from './sprite-proxy.service';
import { RedisService } from '../redis/redis.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

jest.mock('sharp', () => {
  const makeChain = (state: { blurred: boolean }) => ({
    ensureAlpha: () => makeChain(state),
    modulate: () => makeChain(state),
    linear: () => makeChain(state),
    blur: () => makeChain({ blurred: true }),
    png: () => makeChain(state),
    toBuffer: async (): Promise<Buffer> => Buffer.from(state.blurred ? 'blurred-buffer' : 'silhouetted-buffer'),
  });
  return () => makeChain({ blurred: false });
});

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
        colorLevel: 0,
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

  it('doit transformer le buffer en silhouette noire (sharp) si isRevealed est false', async () => {
    mockGet.mockResolvedValue(
      JSON.stringify({
        pokemonId: 25,
        spriteUrl: 'https://example.com/25.png',
        isRevealed: false,
      }),
    );

    mockedAxios.get.mockResolvedValue({
      data: Buffer.from('original-colored-buffer'),
      headers: { 'content-type': 'image/png' },
    });

    const result = await service.getSpriteBuffer('hash-123');
    expect(result.buffer.toString()).toBe('silhouetted-buffer');
    expect(result.contentType).toBe('image/png');
  });

  it('doit renvoyer une version floutée colorée au niveau 1 (isRevealed false)', async () => {
    mockGet.mockResolvedValue(
      JSON.stringify({
        pokemonId: 25,
        spriteUrl: 'https://example.com/25.png',
        isRevealed: false,
        colorLevel: 1,
      }),
    );

    mockedAxios.get.mockResolvedValue({
      data: Buffer.from('original-colored-buffer'),
      headers: { 'content-type': 'image/png' },
    });

    const result = await service.getSpriteBuffer('hash-123');
    expect(result.buffer.toString()).toBe('blurred-buffer');
    expect(result.contentType).toBe('image/png');
  });

  it('doit renvoyer une version défloutée colorée au niveau 2 (isRevealed false)', async () => {
    mockGet.mockResolvedValue(
      JSON.stringify({
        pokemonId: 25,
        spriteUrl: 'https://example.com/25.png',
        isRevealed: false,
        colorLevel: 2,
      }),
    );

    mockedAxios.get.mockResolvedValue({
      data: Buffer.from('original-colored-buffer'),
      headers: { 'content-type': 'image/png' },
    });

    const result = await service.getSpriteBuffer('hash-123');
    expect(result.buffer.toString()).toBe('blurred-buffer');
    expect(result.contentType).toBe('image/png');
  });

  it('doit renvoyer le buffer couleur original si isRevealed est true', async () => {
    mockGet.mockResolvedValue(
      JSON.stringify({
        pokemonId: 25,
        spriteUrl: 'https://example.com/25.png',
        isRevealed: true,
      }),
    );

    mockedAxios.get.mockResolvedValue({
      data: Buffer.from('original-colored-buffer'),
      headers: { 'content-type': 'image/png' },
    });

    const result = await service.getSpriteBuffer('hash-123');
    expect(result.buffer.toString()).toBe('original-colored-buffer');
  });

  it('doit rejeter getSpriteBuffer si la session n’existe pas en cache', async () => {
    mockGet.mockResolvedValue(null);

    await expect(service.getSpriteBuffer('invalid-hash')).rejects.toThrow(NotFoundException);
  });
});
