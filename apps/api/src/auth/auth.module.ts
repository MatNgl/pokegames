import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { DailyResultModule } from '../daily-result/daily-result.module';

const jwtSecret = process.env['JWT_SECRET'];
if (process.env['NODE_ENV'] === 'production' && !jwtSecret) {
  throw new Error('La variable d’environnement JWT_SECRET est strictement obligatoire en production');
}

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: jwtSecret ?? 'pokegames-dev-secret-only',
      signOptions: { expiresIn: '15m' },
    }),
    // Limitation de debit volontairement cantonnee a l'authentification : c'est la seule surface
    // ou le nombre d'essais est en soi une attaque (force brute sur les mots de passe, creation de
    // comptes en masse). Une limite globale casserait le jeu, ou une seule page du Pokedex charge
    // plusieurs dizaines de sprites.
    ThrottlerModule.forRoot([{ name: 'auth', ttl: 60_000, limit: 10 }]),
    DailyResultModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
