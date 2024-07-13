import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cache } from 'cache-manager';

@Injectable()
export class RedisCacheService {
  private readonly logger = new Logger(RedisCacheService.name);

  constructor(@Inject(CACHE_MANAGER) private cacheService: Cache) {}

  async get(key: string): Promise<any> {
    try {
      return await this.cacheService.get(key);
    } catch (error) {
      this.logger.error(
        `Error getting value from Redis cache: ${error.message}`,
      );
      throw error; // Optionally, handle or rethrow the error as needed
    }
  }

  async set(key: string, value: any, ttl: number): Promise<void> {
    try {
      await this.cacheService.set(key, value, ttl);
    } catch (error) {
      this.logger.error(`Error setting value in Redis cache: ${error.message}`);
      throw error; // Optionally, handle or rethrow the error as needed
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.cacheService.del(key);
    } catch (error) {
      this.logger.error(
        `Error deleting value from Redis cache: ${error.message}`,
      );
      throw error; // Optionally, handle or rethrow the error as needed
    }
  }
}

//await this.redisCacheService.set('myKey', 'myValue', 3600); // Set TTL to 3600 seconds (1 hour)
