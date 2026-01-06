import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private client: Redis; // Remove 'static' for standard dependency injection

  onModuleInit() {
    // Variables are guaranteed to be loaded here if using ConfigModule
    const host = process.env.REDIS_HOST || '3.91.182.69';
    const port = Number(process.env.REDIS_PORT) || 11728;
    const password = process.env.REDIS_PASS;

    this.logger.log(`Initializing Redis connection to ${host}:${port}...`);

    this.client = new Redis({
      host,
      port,
      password,
      family: 0, // Auto-detect IPv4/IPv6 to avoid connection drops
      maxRetriesPerRequest: null,
      enableAutoPipelining: true,
      retryStrategy: (times) => Math.min(times * 100, 2000),
      // Only use TLS if your specific Redis provider requires it
      tls: process.env.REDIS_TLS === 'true' ? { rejectUnauthorized: false } : undefined,
    });

    this.client.on('connect', () => this.logger.log('Successfully connected to Redis'));
    this.client.on('error', (err) => this.logger.error(`Redis Client Error: ${err.message}`));
  }

  onModuleDestroy() {
    this.client?.quit();
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