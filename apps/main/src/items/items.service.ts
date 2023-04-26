import { BadRequestException, Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import { sumBy } from "../common/util/array.util.js";
import type {
  CanAuthenticatedUserTradeResponse,
  Collectible,
} from "../roblox/roblox_core/roblox_core.interfaces.js";
import { RobloxCoreService } from "../roblox/roblox_core/roblox_core.service.js";
import { ASSET_DETAILS_UPDATED_EVENT } from "./asset_details/asset_details.constants.js";
import { AssetDetailsStorage } from "./asset_details/asset_details.storage.js";
import { ItemReserveType } from "./item_reserves/enums/item_reserve_type.enum.js";
import { ItemReservesStorage } from "./item_reserves/item_reserves.storage.js";
import { Item } from "./interfaces/item.interface.js";

@Injectable()
export class ItemsService {
  static readonly SMALL_VALUE_THRESHOLD = 1_000;

  private assetDetails: Awaited<ReturnType<AssetDetailsStorage["selectAll"]>> =
    new Map();

  constructor(
    private readonly assetDetailsStorage: AssetDetailsStorage,
    private readonly robloxCoreService: RobloxCoreService,
    private readonly itemReservesStorage: ItemReservesStorage
  ) {}

  async canUseItems(
    roblosecurity: string
  ): Promise<CanAuthenticatedUserTradeResponse> {
    roblosecurity = Buffer.from(roblosecurity).toString("base64");
    return this.robloxCoreService.canAuthenticatedUserTrade(roblosecurity);
  }

  async prepareItems(
    userId: number,
    targetItemIds: number[],
    targetSmallItemId?: number
  ): Promise<PrepareItemsResult> {
    const collectibles = await this.getCollectibles(userId);
    if (!collectibles) {
      throw new BadRequestException({
        error: "failed_to_get_items",
        message: "Failed to get items.",
      });
    }
    if (collectibles.length === 0) {
      throw new BadRequestException({
        error: "no_items",
        message: "You have no items to trade.",
      });
    }
    const ignoreSet = await this.itemReservesStorage.selectAll();
    if (targetSmallItemId && ignoreSet.has(targetSmallItemId)) {
      throw new BadRequestException({
        error: "small_unavailable",
        message: "The specified small is unavailable.",
        details: { itemId: targetSmallItemId },
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
    if (targetSmallItemId) {
      small = collectibles.find(
        (collectible) => collectible.userAssetId === targetSmallItemId
      );
      if (!small) {
        throw new BadRequestException({
          error: "small_not_found",
          message: "The specified small could not be found.",
          details: { itemId: targetSmallItemId },
        });
      }
      ignoreSet.add(targetSmallItemId);
    }
    const items = this.toItems(
      userId,
      collectibles,
      ignoreSet,
      includeSet,
      true
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
      const smalls = this.toSmalls(collectibles, ignoreSet);
      if (smalls.length === 0) {
        throw new BadRequestException({
          error: "no_small",
          message: "You have no smalls to trade.",
        });
      }
      small = smalls[0];
    }
    const value = sumBy(items, "value");
    return { value, items, small };
  }

  async getItems(
    userId: number,
    strict?: boolean,
    targetItemIds?: number[]
  ): Promise<Item[]> {
    const collectibles = await this.getCollectibles(userId);
    if (!collectibles) {
      return [];
    }
    const ignoreSet = await this.itemReservesStorage.selectAll();
    const includeSet = targetItemIds && new Set(targetItemIds);
    const items = this.toItems(
      userId,
      collectibles,
      ignoreSet,
      includeSet,
      strict
    );
    return items;
  }

  async prepareSmall(
    userId: number,
    targetSmallItemId?: number
  ): Promise<Collectible> {
    const targetItemIds = targetSmallItemId ? [targetSmallItemId] : undefined;
    const smalls = await this.getSmalls(userId, targetItemIds);
    if (smalls.length === 0) {
      throw new BadRequestException({
        error: targetSmallItemId ? "small_not_found" : "no_small",
        message: targetSmallItemId
          ? "The specified small could not be found."
          : "You have no smalls to trade.",
      });
    }
    return smalls[0];
  }

  async getSmalls(
    userId: number,
    targetItemIds?: number[]
  ): Promise<Collectible[]> {
    const collectibles = await this.getCollectibles(userId);
    if (!collectibles) {
      return [];
    }
    const ignoreSet = await this.itemReservesStorage.select(
      ItemReserveType.Smalls
    );
    const includeSet = targetItemIds && new Set(targetItemIds);
    const smalls = this.toSmalls(collectibles, ignoreSet, includeSet);
    return smalls;
  }

  async getCollectibles(
    userId: number,
    cursor?: string
  ): Promise<undefined | Collectible[]> {
    const response = await this.robloxCoreService.getUserCollectibles(
      userId,
      cursor
    );
    if (response.ok === false) {
      return undefined;
    }
    if (response.data.nextPageCursor) {
      const moreData = await this.getCollectibles(
        userId,
        response.data.nextPageCursor
      );
      if (moreData === undefined) {
        return undefined;
      }
      response.data.data.push(...moreData);
    }
    return response.data.data;
  }

  private toItems(
    userId: number,
    collectibles: Collectible[],
    ignoreSet?: Set<number>,
    includeSet?: Set<number>,
    strict?: boolean
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
            error: "no_item_data",
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
        if (strict && isTargeted) {
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
    ignoreSet?: Set<number>,
    includeSet?: Set<number>
  ): Collectible[] {
    const smalls = collectibles
      .filter((collectible) => {
        if (ignoreSet?.has(collectible.userAssetId)) {
          return false;
        }
        if (includeSet && !includeSet.has(collectible.userAssetId)) {
          return false;
        }
        const details = this.assetDetails.get(collectible.assetId);
        if (!details) {
          return false;
        }
        const valid = details.value <= ItemsService.SMALL_VALUE_THRESHOLD;
        return valid;
      })
      .sort(({ recentAveragePrice: a }, { recentAveragePrice: b }) => a - b);
    return smalls;
  }

  @OnEvent(ASSET_DETAILS_UPDATED_EVENT)
  async onAssetDetailsUpdated() {
    this.assetDetails = await this.assetDetailsStorage.selectAll();
  }
}

interface PrepareItemsResult {
  value: number;
  items: Item[];
  small: Collectible;
}
