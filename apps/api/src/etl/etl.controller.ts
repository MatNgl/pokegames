import { Controller, Post } from '@nestjs/common';
import { TyradexEtlService } from './tyradex-etl.service';

@Controller('etl')
export class EtlController {
  constructor(private readonly etlService: TyradexEtlService) {}

  @Post('sync')
  async triggerSync(): Promise<{ importedCount: number; message: string }> {
    return this.etlService.syncPokemons();
  }
}
