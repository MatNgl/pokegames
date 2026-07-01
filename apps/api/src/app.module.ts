import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { EtlModule } from './etl/etl.module';
import { EventsModule } from './events/events.module';
import { GameModule } from './game/game.module';
import { HistoryModule } from './history/history.module';
import { PokemonModule } from './pokemon/pokemon.module';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule,
    EtlModule,
    EventsModule,
    GameModule,
    HistoryModule,
    PokemonModule,
    AdminModule,
    AuthModule,
    UsersModule,
  ],
})
export class AppModule {}
