import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { randomUUID } from 'crypto';
import * as dotenv from 'dotenv';
import * as express from 'express';
import helmet from 'helmet';
import * as path from 'path';
import { AppModule } from './app.module';

dotenv.config();

// Polyfill crypto.randomUUID if it doesn't exist
if (!crypto.randomUUID) {
  (crypto as any).randomUUID = randomUUID;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });
  app.setGlobalPrefix('/tawseer/v1');
  app.enableCors({
    origin: '*',
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  });
  app.useGlobalPipes(new ValidationPipe());

  app.use('/public', express.static(path.join(__dirname, '..', 'public')));
  app.use(helmet());
  await app.listen(5000);
}
bootstrap();
