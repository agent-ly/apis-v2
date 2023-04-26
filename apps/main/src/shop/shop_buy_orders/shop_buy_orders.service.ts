import { Injectable } from "@nestjs/common";
import { InjectCollection } from "nestjs-super-mongodb";
import type { Collection } from "mongodb";

import { generateId } from "../../common/util/id.util.js";
import { ShopBuyOrder } from "./shop_buy_order.entity.js";
import { COLLECTION_NAME } from "./shop_buy_orders.constants.js";

@Injectable()
export class ShopBuyOrdersService {
  constructor(
    @InjectCollection(COLLECTION_NAME)
    private readonly collection: Collection<ShopBuyOrder>
  ) {}

  async create(payload: CreateShopBuyOrderPayload): Promise<void> {
    const id = generateId();
    const now = new Date();
    const order: ShopBuyOrder = {
      _id: id,
      buyerId: payload.buyerId,
      robloBuyerId: payload.robloBuyerId,
      assetId: payload.assetId,
      minRate: payload.minRate,
      maxRate: payload.maxRate,
      createdAt: now,
      updatedAt: now,
    };
    await this.collection.insertOne(order);
  }

  findByAssetIds(assetIds: number[]): Promise<ShopBuyOrder[]> {
    return this.collection.find({ assetId: { $in: assetIds } }).toArray();
  }
}

interface CreateShopBuyOrderPayload {
  buyerId: string;
  robloBuyerId: number;
  assetId: number;
  minRate: number;
  maxRate: number;
}
