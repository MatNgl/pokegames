import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { AdminUsersService } from './admin-users.service';
import type { AdminUserDetail, AdminUserSummary } from '@pokegames/shared-types';

@UseGuards(AdminGuard)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly adminUsers: AdminUsersService) {}

  @Get()
  async list(): Promise<AdminUserSummary[]> {
    return this.adminUsers.list();
  }

  @Get(':id')
  async detail(@Param('id') id: string): Promise<AdminUserDetail> {
    return this.adminUsers.detail(id);
  }
}
