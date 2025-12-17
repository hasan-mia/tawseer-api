import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private static client: Redis;

  constructor() {
    if (!RedisCacheService.client) {
      RedisCacheService.client = new Redis({
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: Number(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASS || undefined,
        maxRetriesPerRequest: null,
        enableAutoPipelining: true,
        retryStrategy: (times) => Math.min(times * 100, 2000),
      });

      RedisCacheService.client.on('connect', () => {
        this.logger.log('Connected to Redis');
      });

      RedisCacheService.client.on('error', (error) => {
        this.logger.error(`Error connecting to Redis: ${error.message}`);
      });
    }
  }

  onModuleInit() {
    this.logger.log('RedisCacheService initialized');
  }

  onModuleDestroy() {
    this.logger.log('Closing Redis connection');
    RedisCacheService.client.quit();
  }

  async set(key: string, value: any, ttl: number): Promise<void> {
    try {
      await RedisCacheService.client.set(key, JSON.stringify(value), 'EX', ttl);
      this.logger.log(`Value set in Redis for key: ${key}`);
    } catch (error) {
      this.logger.error(`Error setting value in Redis: ${error.message}`);
      throw error;
    }
  }

  async get(key: string): Promise<any | null> {
    try {
      const value = await RedisCacheService.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      this.logger.error(`Error getting value from Redis: ${error.message}`);
      throw error;
    }
  }

  async del(key: string): Promise<void> {
    try {
      await RedisCacheService.client.del(key);
      this.logger.log(`Value deleted from Redis for key: ${key}`);
    } catch (error) {
      this.logger.error(`Error deleting value from Redis: ${error.message}`);
      throw error;
    }
  }
}
