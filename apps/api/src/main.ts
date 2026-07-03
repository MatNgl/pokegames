import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Derriere un reverse proxy TLS en prod : necessaire pour que req.secure soit correct
  // et que les cookies secure/sameSite=none soient poses de facon fiable.
  if (process.env.NODE_ENV === 'production') {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }

  app.use(cookieParser());

  // Toutes les routes HTTP sont servies sous /api (coherent avec spriteProxyUrl et le client web).
  app.setGlobalPrefix('api');

  const allowedOrigins = process.env['CORS_ORIGIN']
    ? process.env['CORS_ORIGIN'].split(',').map((o) => o.trim())
    : ['http://localhost:5173', 'http://127.0.0.1:5173'];

  app.enableCors({
    origin: allowedOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = process.env['PORT'] ?? 3001;
  await app.listen(port);
  logger.log(`Poké-Idle Backend en écoute sur le port ${port}`);
}

void bootstrap();
