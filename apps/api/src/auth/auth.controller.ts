import { Controller, Post, Body, Res, Req, HttpCode, HttpStatus, Get, UseGuards } from '@nestjs/common';
import { SkipThrottle, Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RegisterRequest, LoginRequest, ChangePasswordRequest } from '@pokegames/shared-types';
import { playerFromRequest } from '../common/player-identity';

interface AuthUser {
  id: string;
}

// En prod, le front et l'API sont sur des domaines differents : le cookie refresh
// doit etre sameSite 'none' + secure pour etre renvoye en cross-site. En dev (meme
// site localhost, HTTP), on reste en 'lax' non secure pour que le cookie passe.
const IS_PROD = process.env.NODE_ENV === 'production';

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: IS_PROD ? ('none' as const) : ('lax' as const),
  path: '/',
};

const REFRESH_COOKIE_MAX_AGE = 1000 * 60 * 60 * 24 * 7; // 7 jours

/**
 * Securite : sans limite de debit, /login accepte un nombre illimite d'essais de mot de passe et
 * /register permet de creer des comptes en masse. Dix requetes par minute et par IP laissent large
 * pour un humain qui se trompe, et rendent la force brute inoperante. `trust proxy` est actif en
 * production, l'IP vue est donc celle du client et non celle du reverse proxy.
 */
@UseGuards(ThrottlerGuard)
@Throttle({ auth: { ttl: 60_000, limit: 10 } })
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() body: RegisterRequest, @Req() req: Request & { user?: AuthUser }) {
    // L'identité invite arrive via l'en-tête X-Guest-Id (requête non authentifiée) : on rattache
    // les scores du jour joués en invité au compte créé. Le body peut aussi la porter (repli).
    // exactOptionalPropertyTypes : n'ajoute guestId que s'il est defini (jamais `guestId: undefined`).
    const guestId = playerFromRequest(req).guestId ?? body.guestId;
    return this.authService.register(guestId ? { ...body, guestId } : body);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: LoginRequest,
    @Req() req: Request & { user?: AuthUser },
    @Res({ passthrough: true }) res: Response,
  ) {
    // Identité invite via l'en-tête X-Guest-Id : rattache au compte les scores joués en invité.
    const guestId = playerFromRequest(req).guestId;
    const { accessToken, refreshToken, user } = await this.authService.login(body, guestId);

    res.cookie('refreshToken', refreshToken, {
      ...REFRESH_COOKIE_OPTIONS,
      maxAge: REFRESH_COOKIE_MAX_AGE,
    });

    return { accessToken, user };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const oldRefreshToken = req.cookies?.refreshToken as string | undefined;
    const { accessToken, refreshToken, user } = await this.authService.refreshTokens(oldRefreshToken || '');

    res.cookie('refreshToken', refreshToken, {
      ...REFRESH_COOKIE_OPTIONS,
      maxAge: REFRESH_COOKIE_MAX_AGE,
    });

    return { accessToken, user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.refreshToken as string | undefined;
    await this.authService.logout(refreshToken);

    // Les options (sameSite/secure/path) doivent matcher celles de pose pour que le navigateur efface bien le cookie.
    res.clearCookie('refreshToken', REFRESH_COOKIE_OPTIONS);
    return { success: true };
  }

  // Lecture du profil : deja protegee par le JWT, et rappelee a chaque retour sur l'onglet.
  // La limiter n'apporte rien et deconnecterait un utilisateur legitime qui navigue vite.
  @SkipThrottle()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@Req() req: Request & { user?: unknown }) {
    return req.user;
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Req() req: Request & { user?: AuthUser },
    @Body() body: ChangePasswordRequest,
  ) {
    await this.authService.changePassword(req.user!.id, body.currentPassword, body.newPassword);
    return { success: true };
  }
}
