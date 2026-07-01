import { Module } from '@nestjs/common';
import { DailyResultService } from './daily-result.service';
import { DailyResultController } from './daily-result.controller';

@Module({
  providers: [DailyResultService],
  controllers: [DailyResultController],
  exports: [DailyResultService],
})
export class DailyResultModule {}
