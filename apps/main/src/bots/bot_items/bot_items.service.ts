import { Injectable } from "@nestjs/common";

import { sumBy } from "../../common/util/array.util.js";
import type { Item } from "../../items/interfaces/item.interface.js";
import { DbItemType } from "../../items/db_items/enums/db_item_type.enum.js";
import { DbItemsService } from "../../items/db_items/db_items.service.js";

@Injectable()
export class BotItemsService {
  constructor(private readonly dbItemsService: DbItemsService) {}

  async getItems(userId: string): Promise<Item[]> {
    const botItems = await this.dbItemsService.findManyByType(DbItemType.Bot, {
      userId,
    });
    return DbItemsService.toOwnedItems(userId, botItems);
  }

  async useItems(payload: UseBotItemsPayload): Promise<UseBotItemsResult> {
    const botItems = await this.dbItemsService.findManyByType(DbItemType.Bot, {
      userId: payload.userId,
      _id: { $in: payload.itemIds },
    });
    this.dbItemsService.areItemsAvailable(payload.itemIds, botItems);
    await this.dbItemsService.setItemsAvailable(false, payload.itemIds);
    if (payload.details) {
      await this.dbItemsService.updateManyById(payload.itemIds, {
        $set: { details: payload.details },
        $currentDate: { updatedAt: true },
      });
    }
    const items = DbItemsService.toOwnedItems(payload.userId, botItems);
    const value = sumBy(items, "value");
    return { value, items };
  }

  async returnItems(itemIds: number[]): Promise<void> {
    await this.dbItemsService.updateManyById(itemIds, {
      $set: { available: true, details: null },
      $currentDate: { updatedAt: true },
    });
  }

  async transferItems(userId: string, itemIds: number[]): Promise<void> {
    await this.dbItemsService.updateManyById(itemIds, {
      $set: { userId: userId },
      $currentDate: { updatedAt: true },
    });
  }

  async deleteItems(itemIds: number[]): Promise<void> {
    await this.dbItemsService.deleteManyById(itemIds);
  }
}

export interface UseBotItemsPayload {
  userId: string;
  itemIds: number[];
  details?: unknown;
}

export interface UseBotItemsResult {
  value: number;
  items: Item[];
}
