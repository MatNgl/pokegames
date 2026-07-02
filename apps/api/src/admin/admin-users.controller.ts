import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { AdminUsersService } from './admin-users.service';
import type { AdminPage, AdminUserDetail, AdminUserSummary } from '@pokegames/shared-types';

@UseGuards(AdminGuard)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly adminUsers: AdminUsersService) {}

  @Get()
  async list(@Query('page') page = '1'): Promise<AdminPage<AdminUserSummary>> {
    return this.adminUsers.list(Number(page) || 1);
  }

  @Get(':id')
  async detail(@Param('id') id: string): Promise<AdminUserDetail> {
    return this.adminUsers.detail(id);
  }
}
