import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private static client: Redis | null = null;
  private static isInitializing = false;

  constructor() {
    // Don't create connection in constructor
  }

  async onModuleInit() {
    if (!RedisCacheService.client && !RedisCacheService.isInitializing) {
      RedisCacheService.isInitializing = true;

      RedisCacheService.client = new Redis({
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: Number(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASS || undefined,
        maxRetriesPerRequest: null,
        enableAutoPipelining: true,
        retryStrategy: (times) => Math.min(times * 100, 2000),
        lazyConnect: true, // Don't connect immediately
      });

      RedisCacheService.client.on('connect', () => {
        this.logger.log('Successfully connected to Redis');
      });

      RedisCacheService.client.on('error', (error) => {
        this.logger.error(`Redis Client Error: ${error.message}`);
      });

      await RedisCacheService.client.connect();
      RedisCacheService.isInitializing = false;
      this.logger.log('RedisCacheService initialized');
    }
  }

  async onModuleDestroy() {
    if (RedisCacheService.client) {
      this.logger.log('Closing Redis connection');
      await RedisCacheService.client.quit();
      RedisCacheService.client = null;
    }
  }

  private getClient(): Redis {
    if (!RedisCacheService.client) {
      throw new Error('Redis client not initialized');
    }
    return RedisCacheService.client;
  }

  async set(key: string, value: any, ttl: number): Promise<void> {
    try {
      await this.getClient().set(key, JSON.stringify(value), 'EX', ttl);
      this.logger.log(`Value set in Redis for key: ${key}`);
    } catch (error) {
      this.logger.error(`Error setting value in Redis: ${error.message}`);
      throw error;
    }
  }

  async get(key: string): Promise<any | null> {
    try {
      const value = await this.getClient().get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      this.logger.error(`Error getting value from Redis: ${error.message}`);
      throw error;
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.getClient().del(key);
      this.logger.log(`Value deleted from Redis for key: ${key}`);
    } catch (error) {
      this.logger.error(`Error deleting value from Redis: ${error.message}`);
      throw error;
    }
  }
}