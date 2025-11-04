// 🔧 CRITICAL: Must be FIRST - Polyfill crypto globally for @nestjs/schedule
import * as crypto from 'crypto';
if (!(global as any).crypto) {
  (global as any).crypto = crypto;
}

// Now your regular imports
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as dotenv from 'dotenv';
import * as express from 'express';
import helmet from 'helmet';
import * as path from 'path';
import { AppModule } from './app.module';

dotenv.config();

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

  const port = process.env.PORT || 5000;
  await app.listen(port);

  console.log(`🚀 Application is running on port ${port}`);
}

bootstrap();