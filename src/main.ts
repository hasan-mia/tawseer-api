import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as crypto from 'crypto'; // Import the entire crypto module
import * as dotenv from 'dotenv';
import * as express from 'express';
import helmet from 'helmet';
import * as path from 'path';
import { AppModule } from './app.module';

dotenv.config();

// Polyfill crypto.randomUUID if it doesn't exist (for older Node.js versions)
if (!crypto.randomUUID) {
  (crypto as any).randomUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };
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

  const port = process.env.PORT || 5000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();