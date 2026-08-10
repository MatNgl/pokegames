import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { AdminEtlService } from './admin-etl.service';
import { TyradexEtlService } from '../etl/tyradex-etl.service';

/** Promesse dont on declenche la resolution a la main, pour observer l'etat pendant l'import. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (err: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('AdminEtlService', () => {
  let service: AdminEtlService;
  let syncPokemons: jest.Mock;

  beforeEach(async () => {
    syncPokemons = jest.fn();
    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminEtlService, { provide: TyradexEtlService, useValue: { syncPokemons } }],
    }).compile();
    service = module.get<AdminEtlService>(AdminEtlService);
  });

  it('doit être défini', () => {
    expect(service).toBeDefined();
  });

  it('part au repos', () => {
    expect(service.getStatus()).toEqual({
      running: false,
      startedAt: null,
      finishedAt: null,
      importedCount: null,
      error: null,
      triggeredBy: null,
    });
  });

  it('rend la main immédiatement et signale l’import en cours', () => {
    const job = deferred<{ importedCount: number; message: string }>();
    syncPokemons.mockReturnValue(job.promise);

    const status = service.start('matngl');

    expect(status.running).toBe(true);
    expect(status.triggeredBy).toBe('matngl');
    expect(status.startedAt).not.toBeNull();
  });

  it('refuse un second import tant que le premier tourne', () => {
    const job = deferred<{ importedCount: number; message: string }>();
    syncPokemons.mockReturnValue(job.promise);

    service.start('matngl');

    expect(() => service.start('autre')).toThrow(ConflictException);
    expect(syncPokemons).toHaveBeenCalledTimes(1);
  });

  it('enregistre le nombre importé à la fin', async () => {
    syncPokemons.mockResolvedValue({ importedCount: 1025, message: 'ok' });

    service.start('matngl');
    await new Promise((r) => setImmediate(r));

    const status = service.getStatus();
    expect(status.running).toBe(false);
    expect(status.importedCount).toBe(1025);
    expect(status.error).toBeNull();
    expect(status.finishedAt).not.toBeNull();
  });

  it('retient le message d’erreur sans rester bloqué en cours', async () => {
    syncPokemons.mockRejectedValue(new Error('Tyradex injoignable'));

    service.start('matngl');
    await new Promise((r) => setImmediate(r));

    const status = service.getStatus();
    expect(status.running).toBe(false);
    expect(status.error).toBe('Tyradex injoignable');
    expect(status.importedCount).toBeNull();
  });

  it('autorise un nouvel import après un échec', async () => {
    syncPokemons.mockRejectedValueOnce(new Error('coupure réseau'));
    service.start('matngl');
    await new Promise((r) => setImmediate(r));

    syncPokemons.mockResolvedValue({ importedCount: 10, message: 'ok' });
    expect(() => service.start('matngl')).not.toThrow();
  });

  it('renvoie une copie de l’état (pas la référence interne)', () => {
    const a = service.getStatus();
    a.running = true;
    expect(service.getStatus().running).toBe(false);
  });
});
