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
    const assetDetails = new Map<number, AssetDetails>();
    for (const [assetId, value] of Object.entries(values)) {
      assetDetails.set(parseInt(assetId, 10), {
        value: parseInt(value, 10),
        metadata: JSON.parse(metadata[assetId] ?? "{}"),
      });
    }
    return assetDetails;
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
    const assetDetails = new Map<number, AssetDetails>();
    for (let i = 0; i < assetIds.length; i++) {
      if (values[i] === null) {
        continue;
      }
      assetDetails.set(assetIds[i], {
        value: parseInt(values[i], 10),
        metadata: JSON.parse(metadata[i] ?? "{}"),
      });
    }
    return assetDetails;
  }

  async update(assetDetails: Map<number, AssetDetails>) {
    const valueTuples: [string, string][] = [];
    const metadataTuples: [string, string][] = [];
    for (const [assetId, { value, metadata }] of assetDetails) {
      valueTuples.push([assetId.toString(), value.toString()]);
      metadataTuples.push([assetId.toString(), JSON.stringify(metadata)]);
    }
    const promises: Promise<unknown>[] = [];
    if (valueTuples.length > 0) {
      promises.push(this.redis.hSet("values", valueTuples));
    }
    if (metadataTuples.length > 0) {
      promises.push(this.redis.hSet("metadata", metadataTuples));
    }
    if (promises.length > 0) {
      await Promise.all(promises);
    }
  }
}

export type AssetDetailsMap = Map<number, AssetDetails>;

export interface AssetDetails {
  value: number;
  metadata: AssetDetailsMetadata;
}

export interface AssetDetailsMetadata {
  projected?: boolean;
  manualProjected?: boolean;
  rolimonsProjected?: boolean;
  autoProjected?: boolean;
}
