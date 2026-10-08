import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { PrismaService } from './common/prisma.service';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { PinoLoggerService } from './common/logger/logger.service';
import { logger } from './common/logger/logger';
import { correlationMiddleware } from './common/middleware/correlation.middleware';

process.on('uncaughtException', (err: Error) => {
  logger.fatal({ err, event: 'uncaughtException' }, err.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason: unknown) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  logger.fatal({ err, event: 'unhandledRejection' }, err.message);
  process.exit(1);
});

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const pinoLogger = app.get(PinoLoggerService);
  app.useLogger(pinoLogger);

  app.use(correlationMiddleware);
  app.use(cookieParser());

  app.setGlobalPrefix('api/v1');

  app.enableVersioning({
    type: VersioningType.URI,
  });

  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3001'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor(), new LoggingInterceptor());

  const prismaService = app.get(PrismaService);
  await prismaService.enableShutdownHooks(app);

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('PulseExpends API')
      .setDescription('Family Expense Management Application API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const host = process.env.HOST || '0.0.0.0';
  const port = process.env.PORT || 3000;
  await app.listen(port, host);
  logger.info({ event: 'server_started', host, port: Number(port) }, `Server listening on http://${host}:${port}`);
}

bootstrap();
