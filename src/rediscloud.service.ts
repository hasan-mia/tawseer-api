import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisCacheService {
  private readonly logger = new Logger(RedisCacheService.name);
  private readonly client: Redis;

  constructor() {
    this.client = new Redis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT),
      password: process.env.REDIS_PASS,
    });

    this.client.on('connect', () => {
      this.logger.log('Connected to Redis');
    });

    this.client.on('error', (error) => {
      this.logger.error(`Error connecting to Redis: ${error.message}`);
    });
  }

  async set(key: string, value: any, ttl: number): Promise<void> {
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttl);
      this.logger.log(`Value set in Redis for key: ${key}`);
    } catch (error) {
      this.logger.error(`Error setting value in Redis: ${error.message}`);
      throw error;
    }
  }

  async get(key: string): Promise<any | null> {
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      this.logger.error(`Error getting value from Redis: ${error.message}`);
      throw error;
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
      this.logger.log(`Value deleted from Redis for key: ${key}`);
    } catch (error) {
      this.logger.error(`Error deleting value from Redis: ${error.message}`);
      throw error;
    }
  }
}
