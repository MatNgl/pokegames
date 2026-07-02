import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { GuessWhoService } from './guess-who.service';
import { GuessWhoGateway } from './guess-who.gateway';

const JWT_SECRET = process.env['JWT_SECRET'] ?? 'pokegames-dev-secret-only';

@Module({
  imports: [JwtModule.register({ secret: JWT_SECRET })],
  providers: [GuessWhoService, GuessWhoGateway],
})
export class GuessWhoModule {}
