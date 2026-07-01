import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

interface AuthUser {
  id: string;
  role: string;
}

/** Acces reserve aux administrateurs : JWT valide + role ADMIN. */
@Injectable()
export class AdminGuard extends AuthGuard('jwt') {
  handleRequest<TUser = AuthUser>(err: unknown, user: TUser | false): TUser {
    if (err || !user) {
      throw err instanceof Error ? err : new UnauthorizedException();
    }
    const authUser = user as unknown as AuthUser;
    if (authUser.role !== 'ADMIN') {
      throw new ForbiddenException('Accès réservé aux administrateurs');
    }
    return user;
  }
}
