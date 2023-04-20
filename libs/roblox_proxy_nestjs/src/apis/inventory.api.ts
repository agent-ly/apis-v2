import { Injectable } from "@nestjs/common";
import { type PageResponse } from "roblox-util/pagination";

import { RobloxClient } from "../roblox.client.js";

export interface Collectible {
  assetId: number;
  userAssetId: number;
  serialNumber: number;
  name: string;
  recentAveragePrice: number;
}

export type GetCollectibleUserAssetsResponse = PageResponse<Collectible>;

@Injectable()
export class InventoryApi {
  constructor(private readonly client: RobloxClient) {}

  getCollectibleUserAssets(
    userId: number,
    cursor?: string,
    roblosecurity?: string
  ): Promise<GetCollectibleUserAssetsResponse> {
    let baseUrl = `https://inventory.roblox.com/v1/users/${userId}/assets/collectibles?sortOrder=Asc&limit=100`;
    if (cursor) {
      baseUrl += `&cursor=${cursor}`;
    }
    const init = { roblosecurity };
    return this.client.json<GetCollectibleUserAssetsResponse>(baseUrl, init);
  }
}
