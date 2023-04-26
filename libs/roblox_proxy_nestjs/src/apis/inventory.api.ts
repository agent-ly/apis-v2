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

export type GetUserOwnedCollectiblesResponse = PageResponse<Collectible>;

export interface CanViewInventorResponse {
  canView: boolean;
}

export type ItemType = "Asset" | "Gamepass" | "Badge" | "Bundle";

export interface Item {
  type: ItemType;
  id: number;
  name: string;
  instanceId: number;
}

export type GetUserOwnedItemsOfTypeResponse = PageResponse<Item>;

@Injectable()
export class InventoryApi {
  constructor(private readonly client: RobloxClient) {}

  getUserOwnedCollectibleAssets(
    userId: number,
    cursor?: string
  ): Promise<GetUserOwnedCollectiblesResponse> {
    let url = `https://inventory.roblox.com/v1/users/${userId}/assets/collectibles?sortOrder=Asc&limit=100`;
    if (cursor) {
      url += `&cursor=${cursor}`;
    }
    return this.client.json(url);
  }

  canViewInventory(userId: number): Promise<CanViewInventorResponse> {
    return this.client.json(
      `https://inventory.roblox.com/v1/users/${userId}/can-view-inventory`
    );
  }

  getUserOwnedItemsOfType(
    userId: number,
    itemType: ItemType,
    itemTargetId: number
  ): Promise<GetUserOwnedItemsOfTypeResponse> {
    return this.client.json(
      `https://inventory.roblox.com/v1/users/${userId}/items/${itemType}/${itemTargetId}`
    );
  }

  userOwnsItemsOfType(
    userId: number,
    itemType: ItemType,
    itemTargetId: number
  ): Promise<boolean> {
    return this.client.json(
      `https://inventory.roblox.com/v1/users/${userId}/items/${itemType}/${itemTargetId}/is-owned`
    );
  }
}
