import {
  BadRequestException,
  Injectable,
  type OnModuleInit,
} from "@nestjs/common";
import { InjectCollection } from "nestjs-super-mongodb";
import type {
  Collection,
  Filter,
  UpdateFilter,
  UpdateResult,
  WithId,
} from "mongodb";

import { pickBy } from "../../common/util/array.util.js";
import { toCoins, toRate } from "../../common/util/currency.util.js";
import type { Item } from "../interfaces/item.interface.js";
import { DbItemType } from "./enums/db_item_type.enum.js";
import { DbItem, BotDbItem, ShopDbItem } from "./db_item.entity.js";
import { COLLECTION_NAME } from "./db_items.constants.js";

@Injectable()
export class DbItemsService implements OnModuleInit {
  static toOwnedItems(userId: string, dbItems: WithId<DbItem>[]): Item[] {
    return dbItems.map((dbItem) => ({
      id: dbItem._id,
      assetId: dbItem.assetId,
      userId: userId,
      serial: dbItem.serial,
      name: dbItem.name,
      value: dbItem.value,
      rap: dbItem.rap,
    }));
  }

  constructor(
    @InjectCollection(COLLECTION_NAME)
    private readonly collection: Collection<DbItem>
  ) {}

  async onModuleInit() {
    await this.collection.createIndex({ type: 1, _id: 1 });
    await this.collection.createIndex({ type: 1, userId: 1 });
    await this.collection.createIndex({ type: 1, userId: 1, _id: 1 });
  }

  createMany(items: DbItem[]) {
    return this.collection.insertMany(items);
  }

  deleteManyById(itemIds: number[]) {
    return this.collection.deleteMany({ _id: { $in: itemIds } });
  }

  findManyById(itemIds: number[]) {
    return this.collection.find({ _id: { $in: itemIds } }).toArray();
  }

  updateManyById(
    itemIds: number[],
    update: UpdateFilter<DbItem>
  ): Promise<UpdateResult> {
    return this.collection.updateMany({ _id: { $in: itemIds } }, update);
  }

  findOneByType(
    type: DbItemType.Bot,
    filter: Filter<BotDbItem>
  ): Promise<WithId<BotDbItem> | null>;
  findOneByType(
    type: DbItemType.Shop,
    filter: Filter<ShopDbItem>
  ): Promise<WithId<ShopDbItem> | null>;
  findOneByType(
    type: DbItemType,
    filter: Filter<DbItem>
  ): Promise<WithId<DbItem> | null> {
    return this.collection.findOne({ type, ...filter });
  }

  findManyByType(
    type: DbItemType.Bot,
    filter: Filter<BotDbItem>
  ): Promise<WithId<BotDbItem>[]>;
  findManyByType(
    type: DbItemType.Shop,
    filter: Filter<ShopDbItem>
  ): Promise<WithId<ShopDbItem>[]>;
  findManyByType(
    type: DbItemType,
    filter: Filter<DbItem>
  ): Promise<WithId<DbItem>[]> {
    return this.collection.find({ type, ...filter }).toArray();
  }

  updateManyByType(
    type: DbItemType.Bot,
    filter: Filter<BotDbItem>,
    update: UpdateFilter<BotDbItem>
  ): Promise<UpdateResult>;
  updateManyByType(
    type: DbItemType.Shop,
    filter: Filter<ShopDbItem>,
    update: UpdateFilter<ShopDbItem>
  ): Promise<UpdateResult>;
  updateManyByType(
    type: DbItemType,
    filter: Filter<DbItem>,
    update: UpdateFilter<DbItem>
  ): Promise<UpdateResult> {
    return this.collection.updateMany(
      {
        type,
        ...filter,
      },
      update
    );
  }

  setItemsAvailable(available: boolean, itemIds: number[]) {
    return this.collection.updateMany(
      { _id: { $in: itemIds } },
      { $set: { available }, $currentDate: { updatedAt: true } }
    );
  }

  areItemsAvailable(itemIds: number[], items: DbItem[]) {
    if (items.length === 0) {
      throw new BadRequestException({
        error: "items_not_found",
        message: "No items were found.",
      });
    }
    if (items.length !== itemIds.length) {
      const missingItemIds = itemIds.filter(
        (itemId) => !items.some((item) => item._id === itemId)
      );
      throw new BadRequestException({
        error: "items_not_found",
        message: "Some items were not found.",
        details: { itemIds: missingItemIds },
      });
    }
    const unavailable = items.filter((item) => !item.available);
    if (unavailable.length > 0) {
      const unavailableItemIds = pickBy(unavailable, "_id");
      throw new BadRequestException({
        error: "items_unavailable",
        message: "Some items are not available.",
        details: { itemIds: unavailableItemIds },
      });
    }
  }

  splitItems<T extends DbItem>(items: T[], predicate: (item: T) => boolean) {
    const { currentItemIds, nextItemIds } = items.reduce(
      (acc, item) => {
        if (predicate(item)) {
          acc.currentItemIds.push(item._id);
        } else {
          acc.nextItemIds.push(item._id);
        }
        return acc;
      },
      { currentItemIds: [] as number[], nextItemIds: [] as number[] }
    );
    return { currentItemIds, nextItemIds };
  }

  prepareBotItems(payload: CreateBotItemsPayload) {
    const now = new Date();
    const botItems = payload.items.map((item) => {
      const botItem: BotDbItem = {
        ...this.prepareItem(payload.userId, item),
        type: DbItemType.Bot,
        botId: payload.botId,
        details: null,
        createdAt: now,
        updatedAt: now,
      };
      return botItem;
    });
    return botItems;
  }

  prepareShopItems(payload: CreateShopItemsPayload) {
    const now = new Date();
    const shopItems = payload.items.map((item) => {
      let rate = payload.rate ?? payload.rates?.get(item.assetId) ?? 2;
      rate = toRate(rate);
      if (rate < 1) {
        throw new BadRequestException({
          error: "rate_too_low",
          message: "Rate cannot be less than $1/1k.",
          details: { itemId: item.id, rate },
        });
      }
      if (rate > 2) {
        throw new BadRequestException({
          error: "rate_too_high",
          message: "Rate cannot be greater than $2/1k.",
          details: { itemId: item.id, rate },
        });
      }
      const price = toCoins(item.value, rate);
      const shopItem: ShopDbItem = {
        ...this.prepareItem(payload.userId, item),
        type: DbItemType.Shop,
        sellerId: payload.sellerId,
        rate,
        price,
        details: null,
        createdAt: now,
        updatedAt: now,
      };
      return shopItem;
    });
    return shopItems;
  }

  private prepareItem(userId: string, item: Item) {
    return {
      _id: item.id,
      userId: userId,
      assetId: item.assetId,
      serial: item.serial,
      name: item.name,
      rap: item.rap,
      value: item.value,
      available: false,
    };
  }
}

interface CreateDbItemsPayload {
  userId: string;
  items: Item[];
}

interface CreateBotItemsPayload extends CreateDbItemsPayload {
  botId: number;
}

interface CreateShopItemsPayload extends CreateDbItemsPayload {
  sellerId: number;
  rate?: number;
  rates?: Map<number, number>;
}
