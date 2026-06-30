import { Module } from '@nestjs/common';
import { TyradexEtlService } from './tyradex-etl.service';
import { EtlController } from './etl.controller';

@Module({
  controllers: [EtlController],
  providers: [TyradexEtlService],
  exports: [TyradexEtlService],
})
export class EtlModule {}
