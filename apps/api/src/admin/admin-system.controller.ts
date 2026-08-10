import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { AdminEtlStatus } from '@pokegames/shared-types';
import { AdminGuard } from '../auth/admin.guard';
import { AdminEtlService } from './admin-etl.service';

/** Outils de maintenance des donnees (onglet Systeme). */
@UseGuards(AdminGuard)
@Controller('admin/system')
export class AdminSystemController {
  constructor(private readonly etl: AdminEtlService) {}

  @Get('etl')
  getEtlStatus(): AdminEtlStatus {
    return this.etl.getStatus();
  }

  @Post('etl')
  startEtl(@Req() req: Request): AdminEtlStatus {
    const user = (req as Request & { user?: { username?: string } }).user;
    return this.etl.start(user?.username ?? 'inconnu');
  }
}
