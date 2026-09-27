import { seededRng, todayUtcDate } from './daily-rng';

describe('daily-rng', () => {
  it('est deterministe : la meme cle donne toujours la meme suite de tirages', () => {
    const a = seededRng('pokedex-game:2026-09-27');
    const b = seededRng('pokedex-game:2026-09-27');
    const drawsA = [a(), a(), a()];
    const drawsB = [b(), b(), b()];
    expect(drawsA).toEqual(drawsB);
  });

  it('renvoie des tirages dans [0, 1)', () => {
    const rng = seededRng('intruder:2026-09-27');
    for (let i = 0; i < 20; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('ne colle plus deux jours consecutifs (regression du bug Generation 1)', () => {
    // Avant l'avalanche (mix32), deux dates consecutives ne differaient que d'une unite de
    // graine : le premier tirage du jour derivait d'a peine un cran par jour au lieu de sauter
    // partout dans le catalogue.
    const poolLen = 1025;
    const indices = Array.from({ length: 30 }, (_, i) => {
      const date = new Date(Date.UTC(2026, 8, 1 + i)).toISOString().split('T')[0]!;
      const rng = seededRng(`pokedex-game:${date}`);
      return Math.floor(rng() * poolLen);
    });
    const spread = Math.max(...indices) - Math.min(...indices);
    expect(spread).toBeGreaterThan(150); // la Generation 1 a elle seule tient dans une plage de 151
  });

  it('des cles differentes (jeux, niveaux, modes) donnent des suites differentes', () => {
    const a = seededRng('shiny:FIND_SHINY:2026-09-27')();
    const b = seededRng('shiny:FIND_NOT_SHINY:2026-09-27')();
    expect(a).not.toBe(b);
  });

  it('todayUtcDate renvoie la date du jour au format AAAA-MM-JJ', () => {
    expect(todayUtcDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
