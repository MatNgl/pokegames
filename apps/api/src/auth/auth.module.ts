import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
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
    DailyResultModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
