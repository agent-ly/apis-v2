import { Injectable } from "@nestjs/common";
import { InjectRedisConnection } from "nestjs-super-redis";
import type { RedisClientType } from "redis";

import { toInts, toStrs } from "../../common/util/array.util.js";
import { ItemReserveType } from "./enums/item_reserve_type.enum.js";

@Injectable()
export class ItemReservesStorage {
  constructor(
    @InjectRedisConnection() private readonly redis: RedisClientType
  ) {}

  async selectAll() {
    const reserves = await this.redis.sUnion([
      ItemReserveType.Items,
      ItemReserveType.Smalls,
    ]);
    return new Set(toInts(reserves));
  }

  async select(type: ItemReserveType) {
    const reserve = await this.redis.sMembers(type);
    return new Set(toInts(reserve));
  }

  async add(type: ItemReserveType, itemIds: number[]) {
    const strAssetIds = toStrs(itemIds);
    return this.redis.sAdd(type, strAssetIds);
  }

  async remove(type: ItemReserveType, itemIds: number[]) {
    const strAssetIds = toStrs(itemIds);
    return this.redis.sRem(type, strAssetIds);
  }

  async has(type: ItemReserveType, itemId: number) {
    return this.redis.sIsMember(type, itemId.toString());
  }
}
