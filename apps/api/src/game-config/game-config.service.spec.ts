import { Test, TestingModule } from '@nestjs/testing';
import { GameConfigService } from './game-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { MOTUS_ADMIN_CONFIG, PLUS_MINUS_CONFIG } from '../game/game-config';

/** Config Motus complete : les schemas sont stricts, un objet partiel est refuse. */
function motusConfig(maxAttempts: number) {
  return {
    levels: {
      ...MOTUS_ADMIN_CONFIG.levels,
      FACILE: { ...MOTUS_ADMIN_CONFIG.levels.FACILE, maxAttempts },
    },
  };
}

describe('GameConfigService', () => {
  let service: GameConfigService;
  let findMany: jest.Mock;
  let create: jest.Mock;
  let upsert: jest.Mock;
  let update: jest.Mock;
  let logCreate: jest.Mock;
  let logFindMany: jest.Mock;

  beforeEach(async () => {
    findMany = jest.fn().mockResolvedValue([]);
    create = jest.fn().mockResolvedValue({});
    upsert = jest.fn().mockResolvedValue({});
    update = jest.fn().mockResolvedValue({});
    logCreate = jest.fn().mockResolvedValue({});
    logFindMany = jest.fn().mockResolvedValue([]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameConfigService,
        {
          provide: PrismaService,
          useValue: {
            gameConfig: { findMany, create, upsert, update },
            adminConfigLog: { create: logCreate, findMany: logFindMany },
          },
        },
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
    await service.update('MOTUS', motusConfig(9));
    expect(upsert).toHaveBeenCalled();
    expect(service.motus().levels.FACILE.maxAttempts).toBe(9);
  });

  it('rejette une clé de config inconnue', async () => {
    await expect(service.update('NOPE', {})).rejects.toThrow('Clé de configuration inconnue');
  });

  describe('validation des valeurs', () => {
    beforeEach(async () => {
      await service.onModuleInit();
      upsert.mockClear();
    });

    it('refuse un nombre hors bornes et ne touche ni la base ni le cache', async () => {
      const before = service.plusMinus().roundsCount;
      await expect(
        service.update('PLUS_MINUS', { ...PLUS_MINUS_CONFIG, roundsCount: 0 }),
      ).rejects.toThrow(/roundsCount/);
      expect(upsert).not.toHaveBeenCalled();
      expect(service.plusMinus().roundsCount).toBe(before);
    });

    it('refuse une valeur négative', async () => {
      await expect(
        service.update('SHINY', { roundsCount: -5, levels: { FACILE: { gridSize: 3 }, MOYEN: { gridSize: 4 }, DIFFICILE: { gridSize: 6 } } }),
      ).rejects.toThrow(/roundsCount/);
    });

    it('refuse un type incorrect', async () => {
      await expect(
        service.update('GUESS_WHO', {
          gridSize: 'vingt-cinq',
          phaseSeconds: { ASKING: 30, ANSWERING: 30, ELIMINATING: 20 },
        }),
      ).rejects.toThrow(/gridSize/);
    });

    it('refuse un champ inconnu plutôt que de le persister silencieusement', async () => {
      await expect(
        service.update('JUST_STAT', {
          roundsCount: 3,
          timeLimitSeconds: 20,
          maxAttempts: 15,
          allowedStats: ['HP'],
          couleurPreferee: 'bleu',
        }),
      ).rejects.toThrow(/champ inconnu/);
    });

    it('refuse une liste vide (un jeu sans critère activé ne peut plus tirer de manche)', async () => {
      await expect(
        service.update('PLUS_MINUS', { ...PLUS_MINUS_CONFIG, enabledStats: [] }),
      ).rejects.toThrow(/enabledStats/);
    });

    it('refuse une borne minimale supérieure à la maximale', async () => {
      await expect(
        service.update('MOTUS', {
          levels: {
            ...MOTUS_ADMIN_CONFIG.levels,
            FACILE: { ...MOTUS_ADMIN_CONFIG.levels.FACILE, minWordLength: 9, maxWordLength: 5 },
          },
        }),
      ).rejects.toThrow(/minWordLength/);
    });

    it('donne le chemin complet du champ fautif', async () => {
      await expect(
        service.update('SHINY', {
          roundsCount: 5,
          levels: { FACILE: { gridSize: 1 }, MOYEN: { gridSize: 4 }, DIFFICILE: { gridSize: 6 } },
        }),
      ).rejects.toThrow('levels.FACILE.gridSize');
    });

    it('accepte une valeur valide', async () => {
      await service.update('SHINY', {
        roundsCount: 8,
        levels: { FACILE: { gridSize: 3 }, MOYEN: { gridSize: 5 }, DIFFICILE: { gridSize: 7 } },
      });
      expect(service.shiny().roundsCount).toBe(8);
    });
  });

  describe('remise aux défauts', () => {
    it('restaure la valeur par défaut et rafraîchit le cache', async () => {
      await service.onModuleInit();
      await service.update('MOTUS', motusConfig(9));
      expect(service.motus().levels.FACILE.maxAttempts).toBe(9);

      const restored = await service.reset('MOTUS');
      expect(service.motus().levels.FACILE.maxAttempts).toBe(
        MOTUS_ADMIN_CONFIG.levels.FACILE.maxAttempts,
      );
      expect(restored).toEqual(MOTUS_ADMIN_CONFIG);
    });

    it('rejette une clé inconnue', async () => {
      await expect(service.reset('NOPE')).rejects.toThrow('Clé de configuration inconnue');
    });
  });

  describe('journalisation', () => {
    beforeEach(async () => {
      await service.onModuleInit();
      logCreate.mockClear();
    });

    it('journalise la modification avec son auteur', async () => {
      await service.update('MOTUS', motusConfig(9), { id: 'u1', username: 'matngl' });
      expect(logCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            key: 'MOTUS',
            action: 'UPDATE',
            adminId: 'u1',
            adminName: 'matngl',
          }),
        }),
      );
    });

    it('journalise la remise aux défauts', async () => {
      await service.reset('SHINY', { id: 'u1', username: 'matngl' });
      expect(logCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'RESET' }) }),
      );
    });

    it('ne journalise pas une modification refusée', async () => {
      await expect(service.update('SHINY', { roundsCount: -1 })).rejects.toThrow();
      expect(logCreate).not.toHaveBeenCalled();
    });

    it("n'empêche pas la sauvegarde si le journal tombe en panne", async () => {
      logCreate.mockRejectedValue(new Error('base indisponible'));
      await expect(service.update('MOTUS', motusConfig(7))).resolves.toBeUndefined();
      expect(service.motus().levels.FACILE.maxAttempts).toBe(7);
    });

    it('résume les champs modifiés plutôt que les objets entiers', async () => {
      logFindMany.mockResolvedValue([
        {
          id: 'l1',
          key: 'SHINY',
          action: 'UPDATE',
          adminName: 'matngl',
          before: { roundsCount: 5, levels: { FACILE: { gridSize: 3 } } },
          after: { roundsCount: 8, levels: { FACILE: { gridSize: 3 } } },
          createdAt: new Date('2026-08-10T10:00:00Z'),
        },
      ]);
      const history = await service.history();
      expect(history[0]?.changes).toEqual([
        { path: 'roundsCount', before: '5', after: '8' },
      ]);
    });
  });
});
