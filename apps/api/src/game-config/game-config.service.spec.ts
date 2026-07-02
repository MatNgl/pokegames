import { Test, TestingModule } from '@nestjs/testing';
import { GameConfigService } from './game-config.service';
import { PrismaService } from '../prisma/prisma.service';

describe('GameConfigService', () => {
  let service: GameConfigService;
  let findMany: jest.Mock;
  let create: jest.Mock;
  let upsert: jest.Mock;
  let update: jest.Mock;

  beforeEach(async () => {
    findMany = jest.fn().mockResolvedValue([]);
    create = jest.fn().mockResolvedValue({});
    upsert = jest.fn().mockResolvedValue({});
    update = jest.fn().mockResolvedValue({});
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameConfigService,
        { provide: PrismaService, useValue: { gameConfig: { findMany, create, upsert, update } } },
      ],
    }).compile();
    service = module.get<GameConfigService>(GameConfigService);
  });

  it('doit être défini', () => {
    expect(service).toBeDefined();
  });

  it('seed les clés manquantes au démarrage et expose les défauts', async () => {
    await service.onModuleInit();
    // 9 clés seedees (aucune en base au depart).
    expect(create).toHaveBeenCalledTimes(9);
    expect(service.plusMinus().roundsCount).toBe(10);
    expect(service.antiRepeatWindow('PLUS_MINUS')).toBe(5);
    expect(service.antiRepeatDetailWindow()).toBe(1);
  });

  it('respecte la valeur en base plutôt que le défaut', async () => {
    findMany.mockResolvedValue([
      { key: 'PLUS_MINUS', value: { roundsCount: 3, levels: {} }, updatedAt: new Date() },
    ]);
    await service.onModuleInit();
    expect(service.plusMinus().roundsCount).toBe(3);
  });

  it('complète une valeur en base avec les nouveaux paramètres par défaut sans écraser l’existant', async () => {
    // Ligne stockee avant l'ajout de enabledStats : la valeur existante (roundsCount) est preservee,
    // le champ manquant est complete depuis le defaut et persiste.
    findMany.mockResolvedValue([
      { key: 'PLUS_MINUS', value: { roundsCount: 7, levels: {} }, updatedAt: new Date() },
    ]);
    await service.onModuleInit();
    expect(service.plusMinus().roundsCount).toBe(7);
    expect(service.plusMinus().enabledStats).toContain('HP');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: 'PLUS_MINUS' } }),
    );
  });

  it('update persiste et rafraîchit le cache', async () => {
    await service.onModuleInit();
    await service.update('MOTUS', { levels: { FACILE: { maxAttempts: 9 } } });
    expect(upsert).toHaveBeenCalled();
    expect(service.motus().levels.FACILE.maxAttempts).toBe(9);
  });

  it('rejette une clé de config inconnue', async () => {
    await expect(service.update('NOPE', {})).rejects.toThrow('Clé de configuration inconnue');
  });
});
