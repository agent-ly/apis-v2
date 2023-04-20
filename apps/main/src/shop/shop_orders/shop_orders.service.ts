import { Injectable, type OnModuleInit } from "@nestjs/common";
import { InjectCollection } from "nestjs-super-mongodb";
import type { Collection } from "mongodb";
import { nanoid } from "nanoid";

import { ShopOrderStatus } from "./enums/shop_order_status.entity.js";
import { ShopOrder } from "./shop_order.entity.js";
import { COLLECTION_NAME } from "./shop_orders.constants.js";

@Injectable()
export class ShopOrdersService implements OnModuleInit {
  constructor(
    @InjectCollection(COLLECTION_NAME)
    private readonly collection: Collection<ShopOrder>
  ) {}

  async onModuleInit(): Promise<void> {
    await this.collection.createIndex({ status: 1 });
    await this.collection.createIndex({ transactionId: 1 });
  }

  create(payload: PlaceOrderPayload): ShopOrder {
    const id = nanoid();
    const now = new Date();
    const shopOrder: ShopOrder = {
      _id: id,
      transactionId: null,
      nextId: null,
      buyerId: payload.buyerId,
      robloBuyerId: payload.robloBuyerId,
      robloSellerId: payload.robloSellerId,
      status: ShopOrderStatus.Waiting,
      expectedTotalPrice: payload.expectedTotalPrice,
      expectedPrices: payload.expectedPrices,
      expectedSellerIds: payload.expectedSellerIds,
      itemIds: payload.itemIds,
      createdAt: now,
      updatedAt: now,
    };
    return shopOrder;
  }

  async add(shopOrder: ShopOrder): Promise<void> {
    await this.collection.insertOne(shopOrder);
  }

  async save(shopOrder: ShopOrder): Promise<void> {
    shopOrder.updatedAt = new Date();
    await this.collection.updateOne(
      { _id: shopOrder._id },
      { $set: shopOrder }
    );
  }

  findById(id: string): Promise<ShopOrder | null> {
    return this.collection.findOne({ _id: id });
  }

  findByTransactionId(transactionId: string): Promise<ShopOrder | null> {
    return this.collection.findOne({ transactionId });
  }

  findPending(): Promise<ShopOrder[]> {
    return this.collection.find({ status: ShopOrderStatus.Pending }).toArray();
  }

  moveToPending(shopOrder: ShopOrder): Promise<void> {
    shopOrder.status = ShopOrderStatus.Pending;
    return this.save(shopOrder);
  }

  moveToProcessed(shopOrder: ShopOrder): Promise<void> {
    shopOrder.status = ShopOrderStatus.Processed;
    return this.save(shopOrder);
  }

  moveToCancelled(shopOrder: ShopOrder): Promise<void> {
    shopOrder.status = ShopOrderStatus.Cancelled;
    return this.save(shopOrder);
  }
}

interface PlaceOrderPayload {
  buyerId: string;
  robloBuyerId: number;
  robloSellerId: number;
  expectedTotalPrice: number;
  expectedPrices: [number, number][];
  expectedSellerIds: [number, string][];
  itemIds: number[];
}
