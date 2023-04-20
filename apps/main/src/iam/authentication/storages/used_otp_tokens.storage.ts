import { Injectable } from "@nestjs/common";
import { InjectRedisConnection } from "nestjs-super-redis";
import type { RedisClientType } from "redis";

@Injectable()
export class UsedOtpTokensStorage {
  constructor(
    @InjectRedisConnection()
    private readonly redis: RedisClientType
  ) {}

  async use(token: string, ttl = 30): Promise<void> {
    await this.redis.setEx(this.getKey(token), ttl, "1");
  }

  async isUsed(token: string): Promise<boolean> {
    const isUsed = await this.redis.get(this.getKey(token));
    return isUsed === "1";
  }

  private getKey(token: string): string {
    return `used_otp_tokens:${token}`;
  }
}
