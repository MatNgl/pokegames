import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PokedexGameService } from './pokedex-game.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { HistoryService } from '../history/history.service';
import { DailyResultService } from '../daily-result/daily-result.service';
import { GameConfigService } from '../game-config/game-config.service';
import { gameConfigMock } from '../game-config/game-config.mock';

/** Fabrique une ligne Prisma avec ses types, dans la forme que renvoie le select du service. */
function row(
  id: number,
  nameFr: string,
  type1: string,
  type2: string | null,
  generation: number,
  evolutionStage: number,
  height: number,
  weight: number,
) {
  const types = [{ slot: 1, type: { nameFr: type1 } }];
  if (type2) types.push({ slot: 2, type: { nameFr: type2 } });
  return { id, nameFr, generation, evolutionStage, height, weight, types };
}

// Catalogue de test : la cible du jour est deterministe, on couvre chaque cas de verdict.
const pool = [
  row(1, 'Bulbizarre', 'Plante', 'Poison', 1, 1, 0.7, 6.9),
  row(2, 'Herbizarre', 'Plante', 'Poison', 1, 2, 1.0, 13.0),
  row(3, 'Florizarre', 'Plante', 'Poison', 1, 3, 2.0, 100.0),
  row(4, 'Salameche', 'Feu', null, 1, 1, 0.6, 8.5),
  row(5, 'Poisson', 'Eau', 'Plante', 4, 1, 0.7, 7.0),
  row(6, 'Grosminet', 'Poison', 'Plante', 9, 2, 5.0, 300.0),
  // Remplissage : maxAttempts vaut 8, il faut assez de propositions distinctes pour perdre.
  ...Array.from({ length: 6 }, (_, i) =>
    row(7 + i, `Figurant${i + 1}`, 'Normal', null, 2, 1, 1.2 + i, 20 + i),
  ),
];

describe('PokedexGameService', () => {
  let service: PokedexGameService;
  let store: Map<string, string>;
  let mockRecord: jest.Mock;
  let mockEmit: jest.Mock;

  beforeEach(async () => {
    store = new Map<string, string>();
    mockRecord = jest.fn().mockResolvedValue(undefined);
    mockEmit = jest.fn().mockReturnValue(true);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PokedexGameService,
        {
          provide: PrismaService,
          useValue: { pokemon: { findMany: jest.fn().mockResolvedValue(pool) } },
        },
        {
          provide: RedisService,
          useValue: {
            get: jest.fn((k: string) => Promise.resolve(store.get(k) ?? null)),
            set: jest.fn((k: string, v: string) => {
              store.set(k, v);
              return Promise.resolve();
            }),
            del: jest.fn(),
          },
        },
        { provide: EventEmitter2, useValue: { emit: mockEmit } },
        {
          provide: HistoryService,
          useValue: {
            recentPokemonIds: jest.fn().mockResolvedValue(new Set<number>()),
            recentDetails: jest.fn().mockResolvedValue(new Set<string>()),
            hasPicksFor: jest.fn().mockResolvedValue(false),
            recordPicks: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: DailyResultService,
          useValue: { hasCompleted: jest.fn().mockResolvedValue(false), record: mockRecord },
        },
        { provide: GameConfigService, useValue: gameConfigMock() },
      ],
    }).compile();

    service = module.get<PokedexGameService>(PokedexGameService);
  });

  /** Force la cible du jour pour rendre les verdicts previsibles. */
  async function startWithTarget(targetId: number): Promise<string> {
    const state = await service.startDaily({ guestId: 'g_test', guestName: 'testeur' });
    const key = `game_pokedex:${state.roundId}`;
    const session = JSON.parse(store.get(key) as string) as { targetId: number };
    session.targetId = targetId;
    store.set(key, JSON.stringify(session));
    return state.roundId;
  }

  it('doit être défini', () => {
    expect(service).toBeDefined();
  });

  describe('startDaily', () => {
    it('démarre une partie vide sans révéler la cible', async () => {
      const state = await service.startDaily();

      expect(state.roundId).toBeDefined();
      expect(state.status).toBe('PLAYING');
      expect(state.attemptsUsed).toBe(0);
      expect(state.guesses).toHaveLength(0);
      // Anti-triche : la reponse ne sort qu'a la fin de la partie.
      expect(state.answer).toBeNull();
    });

    it('tire la même cible pour deux joueurs le même jour', async () => {
      const a = await service.startDaily({ guestId: 'g_a' });
      const b = await service.startDaily({ guestId: 'g_b' });
      const sessionA = JSON.parse(store.get(`game_pokedex:${a.roundId}`) as string) as {
        targetId: number;
      };
      const sessionB = JSON.parse(store.get(`game_pokedex:${b.roundId}`) as string) as {
        targetId: number;
      };
      expect(sessionA.targetId).toBe(sessionB.targetId);
    });
  });

  describe('verdicts', () => {
    it('tout correct sur le bon Pokémon, et la partie est gagnée', async () => {
      const roundId = await startWithTarget(1);
      const res = await service.guess(roundId, 'Bulbizarre');

      expect(res.accepted).toBe(true);
      expect(res.state.status).toBe('WON');
      const line = res.state.guesses[0];
      expect(line?.type1.verdict).toBe('CORRECT');
      expect(line?.type2.verdict).toBe('CORRECT');
      expect(line?.generation.verdict).toBe('CORRECT');
      expect(line?.evolutionStage.verdict).toBe('CORRECT');
      expect(line?.height.verdict).toBe('CORRECT');
      expect(line?.weight.verdict).toBe('CORRECT');
      expect(res.state.answer?.nameFr).toBe('Bulbizarre');
    });

    it('type présent dans l’autre emplacement : partiel des deux côtés', async () => {
      // Cible Poisson (Eau / Plante), proposition Bulbizarre (Plante / Poison).
      const roundId = await startWithTarget(5);
      const res = await service.guess(roundId, 'Bulbizarre');
      const line = res.state.guesses[0];

      expect(line?.type1.verdict).toBe('PARTIAL'); // Plante est le type 2 de la cible
      expect(line?.type2.verdict).toBe('INCORRECT'); // Poison absent de la cible
    });

    it('deux Pokémon sans second type se correspondent sur la colonne Type 2', async () => {
      const roundId = await startWithTarget(4);
      const res = await service.guess(roundId, 'Salameche');
      expect(res.state.guesses[0]?.type2.label).toBe('Aucun');
      expect(res.state.guesses[0]?.type2.verdict).toBe('CORRECT');
    });

    it('un Pokémon mono-type face à une cible bi-type est incorrect', async () => {
      const roundId = await startWithTarget(1); // Bulbizarre, Plante / Poison
      const res = await service.guess(roundId, 'Salameche'); // Feu, sans type 2
      expect(res.state.guesses[0]?.type2.verdict).toBe('INCORRECT');
    });

    it('la génération est binaire et porte une flèche vers la cible', async () => {
      const roundId = await startWithTarget(6); // generation 9
      const res = await service.guess(roundId, 'Bulbizarre'); // generation 1
      const gen = res.state.guesses[0]?.generation;

      expect(gen?.verdict).toBe('INCORRECT');
      expect(gen?.direction).toBe('HIGHER');
      expect(gen?.label).toBe('Gen 1');
    });

    it('le stade d’évolution est partiel à un écart, incorrect à deux', async () => {
      const proche = await startWithTarget(2); // stade 2
      const r1 = await service.guess(proche, 'Bulbizarre'); // stade 1
      expect(r1.state.guesses[0]?.evolutionStage.verdict).toBe('PARTIAL');
      expect(r1.state.guesses[0]?.evolutionStage.direction).toBe('HIGHER');

      const loin = await startWithTarget(3); // stade 3
      const r2 = await service.guess(loin, 'Bulbizarre'); // stade 1
      expect(r2.state.guesses[0]?.evolutionStage.verdict).toBe('INCORRECT');
    });

    it('taille et poids : partiel dans la tolérance, incorrect au-delà, avec la flèche', async () => {
      // Cible Bulbizarre (0,7 m / 6,9 kg), proposition Salameche (0,6 m / 8,5 kg).
      // Tolerance taille = max(10 % de 0,7 ; 0,1) = 0,1 -> ecart 0,1 accepte.
      // Tolerance poids = max(10 % de 6,9 ; 1) = 1 -> ecart 1,6 refuse.
      const roundId = await startWithTarget(1);
      const res = await service.guess(roundId, 'Salameche');
      const line = res.state.guesses[0];

      expect(line?.height.verdict).toBe('PARTIAL');
      expect(line?.height.direction).toBe('HIGHER');
      expect(line?.weight.verdict).toBe('INCORRECT');
      expect(line?.weight.direction).toBe('LOWER');
    });

    it('formate la taille en centimètres sous le mètre et le poids à la française', async () => {
      const roundId = await startWithTarget(3);
      const res = await service.guess(roundId, 'Bulbizarre');
      expect(res.state.guesses[0]?.height.label).toBe('70 cm');
      expect(res.state.guesses[0]?.weight.label).toBe('6,9 kg');

      const autre = await startWithTarget(1);
      const grand = await service.guess(autre, 'Florizarre');
      expect(grand.state.guesses[0]?.height.label).toBe('2,0 m');
    });
  });

  describe('anti-triche', () => {
    it('ne transmet jamais les valeurs de la cible, seulement des verdicts', async () => {
      const roundId = await startWithTarget(6);
      const res = await service.guess(roundId, 'Bulbizarre');

      // La reponse serialisee ne doit contenir ni le nom ni les valeurs de la cible.
      const payload = JSON.stringify(res);
      expect(payload).not.toContain('Grosminet');
      expect(res.state.answer).toBeNull();
      // Seules les cles de verdict sortent du serveur.
      expect(Object.keys(res.state.guesses[0]?.height ?? {}).sort()).toEqual([
        'direction',
        'label',
        'verdict',
      ]);
    });

    it('révèle la cible seulement une fois la partie perdue', async () => {
      const roundId = await startWithTarget(6);
      let res = await service.guess(roundId, 'Bulbizarre');
      expect(res.state.answer).toBeNull();

      // maxAttempts = 8 par defaut : on epuise les essais avec des propositions distinctes.
      const wrong = ['Herbizarre', 'Florizarre', 'Salameche', 'Poisson', 'Figurant1', 'Figurant2', 'Figurant3'];
      for (const name of wrong) {
        res = await service.guess(roundId, name);
      }
      expect(res.state.status).toBe('LOST');
      expect(res.state.answer?.nameFr).toBe('Grosminet');
    });
  });

  describe('propositions refusées', () => {
    it('refuse un nom inconnu sans consommer d’essai', async () => {
      const roundId = await startWithTarget(1);
      const res = await service.guess(roundId, 'Machinchose');

      expect(res.accepted).toBe(false);
      expect(res.state.attemptsUsed).toBe(0);
      expect(res.state.guesses).toHaveLength(0);
    });

    it('refuse un Pokémon déjà proposé sans consommer d’essai', async () => {
      const roundId = await startWithTarget(1);
      await service.guess(roundId, 'Salameche');
      const res = await service.guess(roundId, 'Salameche');

      expect(res.accepted).toBe(false);
      expect(res.state.attemptsUsed).toBe(1);
    });

    it('accepte un nom mal accentué ou mal capitalisé', async () => {
      const roundId = await startWithTarget(1);
      const res = await service.guess(roundId, '  sAlAmÈchE ');
      expect(res.accepted).toBe(true);
      expect(res.state.guesses[0]?.nameFr).toBe('Salameche');
    });

    it('rejette une proposition sur une partie terminée', async () => {
      const roundId = await startWithTarget(1);
      await service.guess(roundId, 'Bulbizarre');
      await expect(service.guess(roundId, 'Salameche')).rejects.toThrow('déjà terminée');
    });
  });

  describe('fin de partie', () => {
    it('enregistre le résultat du jour avec le nombre d’essais', async () => {
      const roundId = await startWithTarget(1);
      await service.guess(roundId, 'Salameche');
      await service.guess(roundId, 'Bulbizarre');

      expect(mockRecord).toHaveBeenCalledWith(
        expect.objectContaining({ guestId: 'g_test' }),
        'POKEDEX',
        '',
        expect.any(Date),
        expect.objectContaining({ won: true, attempts: 2 }),
      );
    });

    it('émet l’événement d’audit à la clôture', async () => {
      const roundId = await startWithTarget(1);
      await service.guess(roundId, 'Bulbizarre');

      expect(mockEmit).toHaveBeenCalledWith(
        'game.round.completed',
        expect.objectContaining({ gameType: 'POKEDEX', isSuccess: true, targetNameFr: 'Bulbizarre' }),
      );
    });

    it('les propositions les plus récentes sont en tête du tableau', async () => {
      const roundId = await startWithTarget(1);
      await service.guess(roundId, 'Salameche');
      const res = await service.guess(roundId, 'Poisson');

      expect(res.state.guesses[0]?.nameFr).toBe('Poisson');
      expect(res.state.guesses[1]?.nameFr).toBe('Salameche');
    });
  });
});
