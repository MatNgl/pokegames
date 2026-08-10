import { Controller, Post, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { TyradexEtlService } from './tyradex-etl.service';

/**
 * Import du catalogue Tyradex. Reserve aux administrateurs : l'endpoint etait ouvert a tous, et
 * declenchait a chaque appel une aspiration complete du catalogue plus 1025 upserts, ce qui suffit
 * a saturer la base et a marteler l'API Tyradex depuis l'exterieur.
 */
@UseGuards(AdminGuard)
@Controller('etl')
export class EtlController {
  constructor(private readonly etlService: TyradexEtlService) {}

  @Post('sync')
  async triggerSync(): Promise<{ importedCount: number; message: string }> {
    return this.etlService.syncPokemons();
  }
}
