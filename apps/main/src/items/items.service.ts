import {
  BadRequestException,
  Injectable,
  type OnModuleInit,
} from "@nestjs/common";

import type {
  CanAuthenticatedUserTradeResponse,
  Collectible,
} from "../roblox/roblox.interfaces.js";
import { RobloxService } from "../roblox/roblox.service.js";
import { AssetDetailsStorage } from "./asset_details/asset_details.storage.js";
import { ItemReserveType } from "./item_reserves/enums/item_reserve_type.enum.js";
import { ItemReservesStorage } from "./item_reserves/item_reserves.storage.js";
import { Item } from "./interfaces/item.interface.js";

@Injectable()
export class ItemsService implements OnModuleInit {
  static readonly SMALL_VALUE_THRESHOLD = 1_000;

  // lol.
  private assetDetails: Awaited<ReturnType<AssetDetailsStorage["select"]>> =
    new Map();

  constructor(
    private readonly robloxService: RobloxService,
    private readonly assetDetailsStorage: AssetDetailsStorage,
    private readonly itemReservesStorage: ItemReservesStorage
  ) {}

  async onModuleInit() {
    await this.loadAssetDetails();
  }

  async loadAssetDetails() {
    const assetDetails = await this.assetDetailsStorage.selectAll();
    this.assetDetails = assetDetails;
  }

  canUseItems(
    roblosecurity: string
  ): Promise<CanAuthenticatedUserTradeResponse>;
  canUseItems(roblosecurity: string, strict: true): Promise<undefined>;
  async canUseItems(roblosecurity: string, strict?: true) {
    const result = await this.robloxService.canAuthenticatedUserTrade(
      roblosecurity
    );
    if (!strict) {
      return result;
    }
    if (!result.ok) {
      throw new BadRequestException({
        error: result.error,
        message: result.message,
      });
    }
  }

  async prepareItems(
    userId: number,
    targetItemIds: number[],
    smallItemId?: number
  ): Promise<PrepareItemsResult> {
    const collectibles = await this.getCollectibles(userId);
    if (collectibles.length === 0) {
      throw new BadRequestException({
        error: "no_items",
        message: "You have no items to trade.",
      });
    }
    const ignoreSet = await this.itemReservesStorage.selectAll();
    if (smallItemId && ignoreSet.has(smallItemId)) {
      throw new BadRequestException({
        error: "small_unavailable",
        message: "The specified small is unavailable.",
        details: { itemId: smallItemId },
      });
    }
    const unavailableItemIds = targetItemIds.filter((itemId) =>
      ignoreSet.has(itemId)
    );
    if (unavailableItemIds.length > 0) {
      throw new BadRequestException({
        error: "items_unavailable",
        message: "One or more items are unavailable.",
        details: { itemIds: unavailableItemIds },
      });
    }
    const includeSet = new Set(targetItemIds);
    let small: Collectible | undefined;
    if (smallItemId) {
      small = collectibles.find(
        (collectible) => collectible.userAssetId === smallItemId
      );
      if (!small) {
        throw new BadRequestException({
          error: "small_not_found",
          message: "The specified small could not be found.",
          details: { itemId: smallItemId },
        });
      }
      ignoreSet.add(smallItemId);
    }
    const items = this.toItems(
      userId,
      collectibles,
      true,
      ignoreSet,
      includeSet
    );
    const missingItemIds = targetItemIds.filter(
      (itemId) => !ignoreSet.has(itemId)
    );
    if (missingItemIds.length > 0) {
      throw new BadRequestException({
        error: "items_not_found",
        message: "One or more items could not be found.",
        details: { itemIds: missingItemIds },
      });
    }
    if (!small) {
      small = this.getSmall(collectibles, ignoreSet);
      if (!small) {
        throw new BadRequestException({
          error: "no_small",
          message: "You have no smalls to trade.",
        });
      }
    }
    const value = items.reduce((sum, item) => sum + item.value, 0);
    return { value, items, small };
  }

  prepareSmall(userId: number): Promise<Collectible | undefined>;
  prepareSmall(userId: number, strict: true): Promise<Collectible>;
  prepareSmall(
    userId: number,
    strict?: boolean
  ): Promise<Collectible | undefined>;
  async prepareSmall(
    userId: number,
    strict?: boolean
  ): Promise<Collectible | undefined> {
    const smalls = await this.getSmalls(userId);
    const small = smalls[0];
    if (strict && !small) {
      throw new BadRequestException({
        error: "no_small",
        message: "You have no smalls to trade.",
      });
    }
    return small;
  }

  async getItems(
    userId: number,
    strict?: boolean,
    targetItemIds?: number[]
  ): Promise<Item[]> {
    const collectibles = await this.getCollectibles(userId, strict);
    const ignoreSet = await this.itemReservesStorage.selectAll();
    const includeSet = targetItemIds && new Set(targetItemIds);
    const items = this.toItems(
      userId,
      collectibles,
      strict,
      ignoreSet,
      includeSet
    );
    return items;
  }

  async getSmalls(userId: number, strict?: boolean): Promise<Collectible[]> {
    const collectibles = await this.getCollectibles(userId, strict);
    const ignoreSet = await this.itemReservesStorage.select(
      ItemReserveType.Smalls
    );
    const smalls = this.toSmalls(collectibles, ignoreSet);
    return smalls;
  }

  async getCollectibles(
    userId: number,
    strict?: boolean
  ): Promise<Collectible[]> {
    const response = await this.robloxService.getUserCollectibles(userId);
    if (response.ok === false) {
      throw new BadRequestException({
        error: "collectibles_unavailable",
        message: "Failed to fetch collectibles.",
      });
    }
    const collectibles = response.data;
    if (strict && collectibles.length === 0) {
      throw new BadRequestException({
        error: "no_collectibles",
        message: "You have no collectibles.",
      });
    }
    return collectibles;
  }

  private getSmall(
    collectibles: Collectible[],
    ignoreSet?: Set<number>
  ): Collectible | undefined {
    const smalls = this.toSmalls(collectibles, ignoreSet);
    return smalls[0];
  }

  private toItems(
    userId: number,
    collectibles: Collectible[],
    strict?: boolean,
    ignoreSet?: Set<number>,
    includeSet?: Set<number>
  ): Item[] {
    const isTargeted = ignoreSet || includeSet ? true : false;
    const items = collectibles.flatMap((collectible) => {
      const ignored = ignoreSet
        ? ignoreSet.has(collectible.userAssetId)
        : false;
      const included = includeSet
        ? includeSet.has(collectible.userAssetId)
        : true;
      if (ignored) {
        if (strict && included) {
          throw new BadRequestException({
            error: "item_unavailable",
            message: `${collectible.name} is unavailable.`,
            details: {
              assetId: collectible.assetId,
              itemId: collectible.userAssetId,
            },
          });
        }
        return [];
      }
      if (!included) {
        return [];
      }
      const details = this.assetDetails.get(collectible.assetId);
      if (!details) {
        if (strict) {
          throw new BadRequestException({
            error: "no_data",
            message: `No data found for ${collectible.name}.`,
            details: {
              assetId: collectible.assetId,
              itemId: collectible.userAssetId,
            },
          });
        }
        return [];
      }
      if (details.metadata.projected) {
        if (isTargeted && strict) {
          throw new BadRequestException({
            error: "item_projected",
            message: `${collectible.name} is projected.`,
            details: {
              assetId: collectible.assetId,
              itemId: collectible.userAssetId,
            },
          });
        }
        return [];
      }
      if (ignoreSet) {
        ignoreSet.add(collectible.userAssetId);
      }
      const item: Item = {
        id: collectible.userAssetId,
        userId: userId,
        assetId: collectible.assetId,
        serial: collectible.serialNumber,
        name: collectible.name,
        value: details.value,
        rap: collectible.recentAveragePrice,
        projected: false,
      };
      if (details.metadata.projected) {
        item.projected = true;
      }
      return [item];
    });
    return items;
  }

  private toSmalls(
    collectibles: Collectible[],
    ignoreSet?: Set<number>
  ): Collectible[] {
    const smalls = collectibles
      .filter(({ assetId }) => {
        if (ignoreSet?.has(assetId)) {
          return false;
        }
        const details = this.assetDetails.get(assetId);
        if (!details) {
          return false;
        }
        const valid = details.value <= ItemsService.SMALL_VALUE_THRESHOLD;
        return valid;
      })
      .sort(({ recentAveragePrice: a }, { recentAveragePrice: b }) => a - b);
    return smalls;
  }
}

interface PrepareItemsResult {
  value: number;
  items: Item[];
  small: Collectible;
}
