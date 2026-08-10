import { ConflictException, Injectable, Logger } from '@nestjs/common';
import type { AdminEtlStatus } from '@pokegames/shared-types';
import { TyradexEtlService } from '../etl/tyradex-etl.service';

/**
 * Declenchement de l'import Tyradex depuis l'admin. L'import dure plusieurs dizaines de secondes
 * (1025 Pokemon, sprites, evolutions) : on le lance en tache de fond et l'interface interroge
 * l'etat, plutot que de laisser une requete HTTP ouverte jusqu'au timeout du navigateur.
 *
 * Etat garde en memoire (mono-instance, comme la partie multijoueur). A passer sur Redis le jour ou
 * l'API tourne sur plusieurs instances.
 */
@Injectable()
export class AdminEtlService {
  private readonly logger = new Logger(AdminEtlService.name);
  private status: AdminEtlStatus = {
    running: false,
    startedAt: null,
    finishedAt: null,
    importedCount: null,
    error: null,
    triggeredBy: null,
  };

  constructor(private readonly etl: TyradexEtlService) {}

  getStatus(): AdminEtlStatus {
    return { ...this.status };
  }

  /** Lance l'import s'il n'y en a pas deja un en cours (deux imports concurrents se marchent dessus). */
  start(triggeredBy: string): AdminEtlStatus {
    if (this.status.running) {
      throw new ConflictException('Un import est déjà en cours');
    }
    this.status = {
      running: true,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      importedCount: null,
      error: null,
      triggeredBy,
    };

    void this.run();
    return this.getStatus();
  }

  private async run(): Promise<void> {
    try {
      const result = await this.etl.syncPokemons();
      this.status = {
        ...this.status,
        running: false,
        finishedAt: new Date().toISOString(),
        importedCount: result.importedCount,
        error: null,
      };
      this.logger.log(`Import termine : ${result.importedCount} Pokemon`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.status = {
        ...this.status,
        running: false,
        finishedAt: new Date().toISOString(),
        importedCount: null,
        error: message,
      };
      this.logger.error(`Import en echec : ${message}`);
    }
  }
}
