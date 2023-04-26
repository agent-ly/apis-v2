import {
  BadRequestException,
  Injectable,
  type OnModuleInit,
} from "@nestjs/common";
import { InjectCollection, InjectMongoConnection } from "nestjs-super-mongodb";
import type {
  Collection,
  Filter,
  FindOptions,
  MongoClient,
  UpdateFilter,
  UpdateResult,
  WithId,
} from "mongodb";

import { groupAllBy, pickBy } from "../../common/util/array.util.js";
import { toCoins, toRate } from "../../common/util/format.util.js";
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
    @InjectMongoConnection()
    private readonly client: MongoClient,
    @InjectCollection(COLLECTION_NAME)
    private readonly collection: Collection<DbItem>
  ) {}

  async onModuleInit() {
    await this.collection.createIndexes([
      { key: { type: 1, _id: 1 } },
      { key: { type: 1, userId: 1 } },
      { key: { type: 1, userId: 1, _id: 1 } },
      { key: { _id: 1, available: 1 } },
      { key: { _id: 1, available: 1, updatedAt: 1 } },
    ]);
  }

  getCollection() {
    return this.collection;
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

  updateOneByType(
    type: DbItemType.Bot,
    filter: Filter<BotDbItem>,
    update: UpdateFilter<BotDbItem>
  ): Promise<UpdateResult>;
  updateOneByType(
    type: DbItemType.Shop,
    filter: Filter<ShopDbItem>,
    update: UpdateFilter<ShopDbItem>
  ): Promise<UpdateResult>;
  updateOneByType(
    type: DbItemType,
    filter: Filter<DbItem>,
    update: UpdateFilter<DbItem>
  ): Promise<UpdateResult> {
    return this.collection.updateOne({ type, ...filter }, update);
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
    filter: Filter<BotDbItem>,
    options?: FindOptions<BotDbItem>
  ): Promise<WithId<BotDbItem>[]>;
  findManyByType(
    type: DbItemType.Shop,
    filter: Filter<ShopDbItem>,
    options?: FindOptions<ShopDbItem>
  ): Promise<WithId<ShopDbItem>[]>;
  findManyByType(
    type: DbItemType,
    filter: Filter<DbItem>,
    options?: FindOptions<DbItem>
  ): Promise<WithId<DbItem>[]> {
    return this.collection.find({ type, ...filter }, options).toArray();
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

  async setItemsAvailable(available: boolean, itemIds: number[]) {
    const updatedAt = new Date();
    const updatedItemIds: number[] = [];
    for (const itemId of itemIds) {
      const { modifiedCount } = await this.collection.updateOne(
        { _id: itemId, available: !available },
        { $set: { available, updatedAt } }
      );
      if (modifiedCount === 1) {
        updatedItemIds.push(itemId);
      } else {
        const newUpdatedAt = new Date();
        await this.collection.updateMany(
          { _id: { $in: updatedItemIds }, available, updatedAt },
          { $set: { available: !available, updatedAt: newUpdatedAt } }
        );
        if (available === false) {
          throw new BadRequestException({
            error: "item_not_available",
            message: "An item is not available.",
            details: { itemId },
          });
        }
      }
    }
  }

  areItemsAvailable(itemIds: number[], items: DbItem[]) {
    if (items.length === 0) {
      throw new BadRequestException({
        error: "items_not_found",
        message: "No items were found.",
      });
    }
    const itemsById = groupAllBy(items, "_id");
    for (const [itemId, [item]] of itemsById) {
      if (!itemIds.includes(itemId)) {
        throw new BadRequestException({
          error: "item_not_found",
          message: "An item was not found.",
          details: { itemId },
        });
      }
      if (!item.available) {
        throw new BadRequestException({
          error: "item_not_available",
          message: "An item is not available.",
          details: { itemId },
        });
      }
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
        robloUserId: payload.robloUserId,
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
  robloUserId: number;
  rate?: number;
  rates?: Map<number, number>;
}
