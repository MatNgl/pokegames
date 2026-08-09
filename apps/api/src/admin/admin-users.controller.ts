import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AdminGuard } from '../auth/admin.guard';
import { AdminUsersService } from './admin-users.service';
import type {
  AdminPage,
  AdminUpdateRoleRequest,
  AdminUserDetail,
  AdminUserSummary,
} from '@pokegames/shared-types';

interface AuthUser {
  id: string;
}

@UseGuards(AdminGuard)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly adminUsers: AdminUsersService) {}

  @Get()
  async list(
    @Query('page') page = '1',
    @Query('q') q?: string,
    @Query('sort') sort?: string,
  ): Promise<AdminPage<AdminUserSummary>> {
    const allowed = ['recent', 'games', 'time', 'name'] as const;
    const safeSort = allowed.includes(sort as (typeof allowed)[number])
      ? (sort as (typeof allowed)[number])
      : 'recent';
    return this.adminUsers.list(Number(page) || 1, q, safeSort);
  }

  @Get(':id')
  async detail(@Param('id') id: string): Promise<AdminUserDetail> {
    return this.adminUsers.detail(id);
  }

  @Patch(':id/role')
  async updateRole(
    @Req() req: Request & { user?: AuthUser },
    @Param('id') id: string,
    @Body() body: AdminUpdateRoleRequest,
  ): Promise<{ ok: true }> {
    await this.adminUsers.updateRole(id, body.role, req.user!.id);
    return { ok: true };
  }

  @Delete(':id')
  async remove(
    @Req() req: Request & { user?: AuthUser },
    @Param('id') id: string,
  ): Promise<{ ok: true }> {
    await this.adminUsers.remove(id, req.user!.id);
    return { ok: true };
  }

  @Post(':id/reset-daily')
  @HttpCode(HttpStatus.OK)
  async resetDaily(@Param('id') id: string): Promise<{ deleted: number }> {
    const deleted = await this.adminUsers.resetDaily(id);
    return { deleted };
  }
}
