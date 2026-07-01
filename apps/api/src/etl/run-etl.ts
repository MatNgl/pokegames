import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app.module';
import { TyradexEtlService } from './tyradex-etl.service';

/**
 * Runner autonome de la synchronisation Tyradex, exécutable hors du serveur HTTP
 * (commande npm run etl). Réutilise le service ETL applicatif via un contexte Nest.
 */
async function main(): Promise<void> {
  const logger = new Logger('RunEtl');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const etl = app.get(TyradexEtlService);
    const result = await etl.syncPokemons();
    logger.log(result.message);
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  const logger = new Logger('RunEtl');
  logger.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
