import { Injectable, type OnModuleInit } from "@nestjs/common";
import { InjectCollection } from "nestjs-super-mongodb";
import type { Collection } from "mongodb";

import { generateId } from "../../common/util/id.util.js";
import { ShopSellOrderStatus } from "./enums/shop_sell_order_status.entity.js";
import { ShopSellOrder } from "./shop_sell_order.entity.js";
import { COLLECTION_NAME } from "./shop_sell_orders.constants.js";

@Injectable()
export class ShopSellOrdersService implements OnModuleInit {
  constructor(
    @InjectCollection(COLLECTION_NAME)
    private readonly collection: Collection<ShopSellOrder>
  ) {}

  async onModuleInit(): Promise<void> {
    await this.collection.createIndex({ status: 1 });
    await this.collection.createIndex({ transactionId: 1 });
  }

  prepare(payload: PlaceOrderPayload): ShopSellOrder {
    const id = generateId();
    const now = new Date();
    const order: ShopSellOrder = {
      _id: id,
      transactionId: payload.transactionId,
      itemTransactionId: null,
      nextOrderId: null,
      buyerId: payload.buyerId,
      robloBuyerId: payload.robloBuyerId,
      robloSellerId: payload.robloSellerId,
      status: ShopSellOrderStatus.Waiting,
      expectedCost: payload.expectedCost,
      expectedPrices: payload.expectedPrices,
      expectedSellerIds: payload.expectedSellerIds,
      itemIds: payload.itemIds,
      createdAt: now,
      updatedAt: now,
    };
    return order;
  }

  async add(order: ShopSellOrder): Promise<void> {
    await this.collection.insertOne(order);
  }

  async save(order: ShopSellOrder): Promise<void> {
    order.updatedAt = new Date();
    await this.collection.updateOne({ _id: order._id }, { $set: order });
  }

  async findOrderChain(order: ShopSellOrder): Promise<ShopSellOrder[]> {
    const orders: ShopSellOrder[] = [];
    let currentOrderId = order.nextOrderId;
    while (currentOrderId) {
      const order = await this.findById(currentOrderId);
      if (!order) {
        break;
      }
      orders.push(order);
      currentOrderId = order.nextOrderId;
    }
    return orders;
  }

  findById(id: string): Promise<ShopSellOrder | null> {
    return this.collection.findOne({ _id: id });
  }

  findByTransactionId(transactionId: string): Promise<ShopSellOrder | null> {
    return this.collection.findOne({ transactionId });
  }

  findByItemTransactionId(
    itemTransactionId: string
  ): Promise<ShopSellOrder | null> {
    return this.collection.findOne({ itemTransactionId });
  }

  findPending(): Promise<ShopSellOrder[]> {
    return this.collection
      .find({ status: ShopSellOrderStatus.Pending })
      .toArray();
  }

  moveToPending(order: ShopSellOrder): Promise<void> {
    order.status = ShopSellOrderStatus.Pending;
    return this.save(order);
  }

  moveToProcessed(order: ShopSellOrder): Promise<void> {
    order.status = ShopSellOrderStatus.Processed;
    return this.save(order);
  }

  moveToCancelled(order: ShopSellOrder): Promise<void> {
    order.status = ShopSellOrderStatus.Cancelled;
    return this.save(order);
  }
}

export interface PlaceOrderPayload {
  transactionId: string;
  buyerId: string;
  robloBuyerId: number;
  robloSellerId: number;
  expectedCost: number;
  expectedSellerIds: [number, string][];
  expectedPrices: [number, number][];
  itemIds: number[];
}
