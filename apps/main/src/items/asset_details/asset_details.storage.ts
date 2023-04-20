import { Injectable } from "@nestjs/common";
import { InjectRedisConnection } from "nestjs-super-redis";
import type { RedisClientType } from "redis";

import { toStrs } from "../../common/util/array.util.js";

@Injectable()
export class AssetDetailsStorage {
  constructor(
    @InjectRedisConnection() private readonly redis: RedisClientType
  ) {}

  async selectAll() {
    const [values, metadata] = await Promise.all([
      this.redis.hGetAll("values"),
      this.redis.hGetAll("metadata"),
    ]);
    const itemDetails = new Map<number, AssetDetails>();
    for (const [assetId, value] of Object.entries(values)) {
      itemDetails.set(parseInt(assetId, 10), {
        value: parseInt(value, 10),
        metadata: JSON.parse(metadata[assetId] ?? "{}"),
      });
    }
    return itemDetails;
  }

  async selectValues(assetIds: number[]) {
    const strAssetIds = toStrs(assetIds);
    const values = await this.redis.hmGet("values", strAssetIds);
    const assetValues = new Map<number, number>();
    for (let i = 0; i < assetIds.length; i++) {
      if (values[i] === null) {
        continue;
      }
      assetValues.set(assetIds[i], parseInt(values[i], 10));
    }
    return assetValues;
  }

  async select(assetIds: number[]) {
    const strAssetIds = toStrs(assetIds);
    const [values, metadata] = await Promise.all([
      this.redis.hmGet("values", strAssetIds),
      this.redis.hmGet("metadata", strAssetIds),
    ]);
    const itemDetails = new Map<number, AssetDetails>();
    for (let i = 0; i < assetIds.length; i++) {
      if (values[i] === null) {
        continue;
      }
      itemDetails.set(assetIds[i], {
        value: parseInt(values[i], 10),
        metadata: JSON.parse(metadata[i] ?? "{}"),
      });
    }
    return itemDetails;
  }

  async update(itemDetails: Map<number, AssetDetails>) {
    const valueTuples: [string, string][] = [];
    const metadataTuples: [string, string][] = [];
    for (const [assetId, { value, metadata }] of itemDetails) {
      valueTuples.push([assetId.toString(), value.toString()]);
      metadataTuples.push([assetId.toString(), JSON.stringify(metadata)]);
    }
    await Promise.all([
      this.redis.hSet("values", valueTuples),
      this.redis.hSet("metadata", metadataTuples),
    ]);
  }
}

interface AssetDetails {
  value: number;
  metadata: AssetDetailsMetadata;
}

interface AssetDetailsMetadata {
  projected?: boolean;
  manualProjected?: boolean;
  rolimonsProjected?: boolean;
  autoProjected?: boolean;
}
