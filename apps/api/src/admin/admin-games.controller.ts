import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import {
  WHO_IS_IT_ADMIN_CONFIG,
  WhoIsItAdminConfig,
  MOTUS_ADMIN_CONFIG,
  MotusAdminConfig,
} from '../game/game-config';

/**
 * Consultation des configurations de jeux. La config est aujourd'hui STATIQUE : elle vit dans
 * game-config.ts et est lue directement par les services. L'edition dynamique (POST) et l'ecran
 * admin viendront dans une phase dediee (un store de config mutable, injecte par les services et
 * ce controleur, remplacera alors la lecture des constantes). Ne pas exposer de POST tant que les
 * services lisent les constantes, sous peine d'un endpoint sans effet.
 */
@UseGuards(AdminGuard)
@Controller('admin/games')
export class AdminGamesController {
  @Get('who-is-it')
  getWhoIsItConfig(): WhoIsItAdminConfig {
    return WHO_IS_IT_ADMIN_CONFIG;
  }

  @Get('motus')
  getMotusConfig(): MotusAdminConfig {
    return MOTUS_ADMIN_CONFIG;
  }
}
