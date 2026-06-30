import { Controller, Get, Query, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

interface AuthenticatedUser {
  id: string;
  email: string;
  username: string;
  role: string;
}

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('leaderboard')
  async getLeaderboard(@Query('limit') limit?: string) {
    return this.usersService.getLeaderboard(Number(limit) || 10);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/history')
  async getMyHistory(@Req() req: Request & { user?: AuthenticatedUser }, @Query('limit') limit?: string) {
    if (!req.user?.id) {
      throw new UnauthorizedException();
    }
    return this.usersService.getPlayerHistory(req.user.id, Number(limit) || 20);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMyProfile(@Req() req: Request & { user?: AuthenticatedUser }) {
    if (!req.user?.id) {
      throw new UnauthorizedException();
    }
    return this.usersService.getProfile(req.user.id);
  }
}
