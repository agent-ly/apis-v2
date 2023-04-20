import { Injectable } from "@nestjs/common";
import { InjectRedisConnection } from "nestjs-super-redis";
import type { RedisClientType } from "redis";

@Injectable()
export class RefreshTokenIdsStorage {
  constructor(
    @InjectRedisConnection()
    private readonly redis: RedisClientType
  ) {}

  async insert(userId: string, value: string, ttl = 8.64e4): Promise<void> {
    await this.redis.setEx(this.getKey(userId), ttl, value);
  }

  async validate(userId: string, tokenId: string): Promise<boolean> {
    const storedTokenId = await this.redis.get(this.getKey(userId));
    return storedTokenId === tokenId;
  }

  async invalidate(userId: string): Promise<void> {
    await this.redis.del(this.getKey(userId));
  }

  private getKey(userId: string): string {
    return `refresh_token_ids:${userId}`;
  }
}
