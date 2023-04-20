import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter";
import { RedisUtilService } from "nestjs-super-redis/util";

import { groupBy, sumBy } from "../common/util/array.util.js";
import { RobloxService } from "../roblox/roblox.service.js";
import { TransactionEvent } from "../wallet/transactions/enums/transaction_event.enum.js";
import { WalletService } from "../wallet/wallet.service.js";
import { DbItemType } from "../items/db_items/enums/db_item_type.enum.js";
import type { ShopDbItem } from "../items/db_items/db_item.entity.js";
import { DbItemsService } from "../items/db_items/db_items.service.js";
import { ItemReserveType } from "../items/item_reserves/enums/item_reserve_type.enum.js";
import { ItemReservesStorage } from "../items/item_reserves/item_reserves.storage.js";
import { ItemsService } from "../items/items.service.js";
import { ShopUsersService } from "./shop_users/shop_users.service.js";
import { ShopOrder } from "./shop_orders/shop_order.entity.js";
import { ShopOrdersService } from "./shop_orders/shop_orders.service.js";
import { ITEM_TRANSACTION_PROCESSED_EVENT } from "../items/item_transactions/item_transactions.constants.js";
import { ItemTransactionEvent } from "../items/item_transactions/enums/item_transaction_event.enum.js";
import { ItemTransactionProcessedEvent } from "../items/item_transactions/events/item_transaction_processed.event.js";

@Injectable()
export class ShopService {
  private static readonly WITHDRAW_EVENT = `${ITEM_TRANSACTION_PROCESSED_EVENT}.${ItemTransactionEvent.Shop_Withdraw}`;

  private readonly logger = new Logger(ShopService.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly redisUtilService: RedisUtilService,
    private readonly robloxService: RobloxService,
    private readonly walletService: WalletService,
    private readonly dbItemsService: DbItemsService,
    private readonly itemReservesStorage: ItemReservesStorage,
    private readonly itemsService: ItemsService,
    private readonly shopUsersService: ShopUsersService,
    private readonly shopOrdersService: ShopOrdersService
  ) {}

  async getItems(): Promise<ShopDbItem[]> {
    const items = await this.dbItemsService.findManyByType(DbItemType.Shop, {
      available: true,
    });
    return items;
  }

  async listItems(payload: ListItemsPayload): Promise<void> {
    // TODO: Protect with captcha
    // TODO: Check if user meets the requirements to trade items
    const lockKey = `shop:listing_items:${payload.userId}`;
    const lockTtl = 30;
    const locked = await this.redisUtilService.withLock(lockKey, lockTtl, () =>
      this.handleListItems(payload)
    );
    if (locked === null) {
      throw new BadRequestException({
        error: "already_listing_items",
        message: "You are already listing items.",
      });
    }
  }

  async orderItems(payload: OrderItemsPayload): Promise<void> {
    // TODO: Protect with captcha
    // TODO: Check if user meets the requirements to trade items
    const lockKey = `shop:ordering_items:${payload.userId}`;
    const lockTtl = 30;
    const locked = await this.redisUtilService.withLock(lockKey, lockTtl, () =>
      this.handleOrderItems(payload)
    );
    if (locked === null) {
      throw new BadRequestException({
        error: "already_ordering_items",
        message: "You are already ordering items.",
      });
    }
  }

  async buyItems(payload: BuyItemsPayload): Promise<void> {
    // TODO: Protect with captcha
    // TODO: Check if user meets the requirements to trade items
    const lockKey = `shop:buying_items:${payload.userId}`;
    const lockTtl = 30;
    const locked = await this.redisUtilService.withLock(lockKey, lockTtl, () =>
      this.handleBuyItems(payload)
    );
    if (locked == null) {
      throw new BadRequestException({
        error: "already_buying_items",
        message: "You are already buying items.",
      });
    }
  }

  async unlistItems(payload: UnlistItemsPayload): Promise<void> {
    // TODO: Protect with captcha
    const lockKey = `shop:unlisting_items:${payload.userId}`;
    const lockTtl = 30;
    const locked = await this.redisUtilService.withLock(lockKey, lockTtl, () =>
      this.handleUnlistItems(payload)
    );
    if (locked === null) {
      throw new BadRequestException({
        error: "already_unlisting_items",
        message: "You are already unlisting items.",
      });
    }
  }

  async editItemRate(payload: EditItemRatePayload): Promise<void> {
    // TODO: Protect with captcha
    const lockKey = `shop:editing_item_rate:${payload.userId}:${payload.itemId}`;
    const lockTtl = 30;
    const locked = await this.redisUtilService.withLock(lockKey, lockTtl, () =>
      this.handleEditItemRate(payload)
    );
    if (locked === null) {
      throw new BadRequestException({
        error: "already_editing_item_rate",
        message: "You are already editing this item's rate.",
      });
    }
  }

  private async handleListItems(payload: ListItemsPayload): Promise<void> {
    const items = await this.itemsService.getItems(
      payload.robloUserId,
      true,
      payload.itemIds
    );
    const shopItems = this.dbItemsService.prepareShopItems({
      userId: payload.userId,
      sellerId: payload.robloUserId,
      rate: payload.rate,
      rates: payload.rates ? new Map(payload.rates) : undefined,
      items,
    });
    await this.shopUsersService.createOrUpdate({
      userId: payload.robloUserId,
      roblosecurity: payload.roblosecurity,
      totpSecret: payload.totpSecret,
    });
    this.itemReservesStorage.add(ItemReserveType.Items, payload.itemIds);
    this.eventEmitter.emit("shop.items.prepared", shopItems);
  }

  private async handleOrderItems(payload: OrderItemsPayload): Promise<void> {
    await this.shopUsersService.createOrUpdate({
      userId: payload.robloUserId,
      roblosecurity: payload.roblosecurity,
      totpSecret: payload.totpSecret,
    });
  }

  private async handleBuyItems(payload: BuyItemsPayload): Promise<void> {
    const items = await this.dbItemsService.findManyByType(DbItemType.Shop, {
      _id: { $in: payload.itemIds },
    });
    this.dbItemsService.areItemsAvailable(payload.itemIds, items);
    for (const item of items) {
      if (item.userId === payload.userId) {
        throw new BadRequestException({
          error: "cannot_buy_own_items",
          message: "You cannot buy your own items.",
        });
      }
    }
    const totalPrice = sumBy(items, "price");
    await this.walletService.subtractBalance({
      userId: payload.userId,
      event: TransactionEvent.Shop_Buy,
      amount: totalPrice,
      details: {
        robloUserId: payload.robloUserId,
        itemIds: payload.itemIds,
      },
    });
    await this.dbItemsService.setItemsAvailable(false, payload.itemIds);
    this.eventEmitter.emit("shop.items.hidden", payload.itemIds);
    const itemsBySellerId = groupBy(items, "sellerId");
    const orders: ShopOrder[] = [];
    for (const [sellerId, items] of itemsBySellerId) {
      const seller = await this.shopUsersService.findById(sellerId);
      if (!seller) {
        throw new BadRequestException({
          error: "seller_not_found",
          message: "A seller was not found.",
        });
      }
      if (!seller.enabled) {
        throw new BadRequestException({
          error: "seller_disabled",
          message: "A seller is disabled.",
        });
      }
      const { expectedTotalPrice, expectedPrices, expectedSellerIds, itemIds } =
        items.reduce(
          (acc, item) => {
            acc.expectedTotalPrice += item.price;
            acc.expectedPrices.set(item._id, item.price);
            acc.expectedSellerIds.set(item._id, item.userId);
            acc.itemIds.push(item._id);
            return acc;
          },
          {
            expectedTotalPrice: 0,
            expectedPrices: new Map<number, number>(),
            expectedSellerIds: new Map<number, string>(),
            itemIds: [] as number[],
          }
        );
      const order = this.shopOrdersService.create({
        buyerId: payload.userId,
        robloBuyerId: payload.robloUserId,
        robloSellerId: sellerId,
        expectedTotalPrice,
        expectedPrices: [...expectedPrices],
        expectedSellerIds: [...expectedSellerIds],
        itemIds,
      });
      orders.push(order);
    }
    await this.shopUsersService.createOrUpdate({
      userId: payload.robloUserId,
      roblosecurity: payload.roblosecurity,
      totpSecret: payload.totpSecret,
    });
    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      if (i !== orders.length - 1) {
        order.nextId = orders[i + 1]._id;
      }
      await this.shopOrdersService.add(order);
    }
    await this.shopOrdersService.moveToPending(orders[0]);
  }

  private async handleUnlistItems(payload: UnlistItemsPayload): Promise<void> {
    const items = await this.dbItemsService.findManyByType(DbItemType.Shop, {
      _id: { $in: payload.itemIds },
    });
    const owns = items.every((item) => item.userId === payload.userId);
    if (!owns) {
      throw new UnauthorizedException({
        message: "You do not own all of the items you are trying to unlist.",
      });
    }
    this.dbItemsService.areItemsAvailable(payload.itemIds, items);
    await this.dbItemsService.deleteManyById(payload.itemIds);
    await this.itemReservesStorage.remove(
      ItemReserveType.Items,
      payload.itemIds
    );
  }

  private async handleEditItemRate(
    payload: EditItemRatePayload
  ): Promise<void> {
    const item = await this.dbItemsService.findOneByType(DbItemType.Shop, {
      _id: payload.itemId,
    });
    if (!item) {
      throw new BadRequestException({
        error: "item_not_found",
        message: "Item not found.",
      });
    }
    if (item.userId !== payload.userId) {
      throw new UnauthorizedException({
        message: "You do not own this item.",
      });
    }
  }

  @OnEvent("shop.items.prepared")
  async onItemsPrepared(items: ShopDbItem[]): Promise<void> {
    // Process buy orders ...
    // List remaining items ...
    await this.dbItemsService.createMany(items);
    this.eventEmitter.emit("shop.items.listed", items);
  }

  @OnEvent(ShopService.WITHDRAW_EVENT)
  async onItemsProcessed(event: ItemTransactionProcessedEvent): Promise<void> {
    const order = await this.shopOrdersService.findByTransactionId(
      event.transaction._id
    );
    if (!order) {
      return this.logger.warn(
        `Order not found for Item Transaction ${event.transaction._id}.`
      );
    }
    const ownership = new Map(event.result.ownershipDetails.userAssetIds);
    const received = ownership.get(order.robloBuyerId);
    const refund = { amount: 0, itemIds: [] as number[] };
    if (received && received.length > 0) {
      const receivedSet = new Set(received);
      const expectedPricesMap = new Map(order.expectedPrices);
      const expectedSellerIdsMap = new Map(order.expectedSellerIds);
      const soldMap = new Map<string, { amount: number; itemIds: number[] }>();
      for (const itemId of order.itemIds) {
        const price = expectedPricesMap.get(itemId);
        const sellerId = expectedSellerIdsMap.get(itemId);
        if (!price) {
          console.warn(`Expected price for item ${itemId} not found.`);
          continue;
        }
        if (!sellerId) {
          console.warn(`Expected seller for item ${itemId} not found.`);
          continue;
        }
        if (receivedSet.has(itemId)) {
          const current = soldMap.get(sellerId) || {
            amount: 0,
            itemIds: [],
          };
          current.amount += price;
          current.itemIds.push(itemId);
          soldMap.set(sellerId, current);
        } else {
          refund.amount += price;
          refund.itemIds.push(itemId);
        }
      }
      if (soldMap.size > 0) {
        for (const [sellerId, { amount, itemIds }] of soldMap) {
          await this.walletService.addBalance({
            userId: sellerId,
            event: TransactionEvent.Shop_Sold,
            amount,
            details: {
              buyerId: order.robloBuyerId,
              sellerId: order.robloSellerId,
              soldItemIds: itemIds,
            },
          });
        }
      }
    } else {
      refund.amount = order.expectedTotalPrice;
      refund.itemIds = order.itemIds;
    }
    if (refund.amount > 0) {
      await this.walletService.addBalance({
        userId: order.buyerId,
        event: TransactionEvent.Shop_Refund,
        amount: refund.amount,
        details: {
          buyerId: order.robloBuyerId,
          sellerId: order.robloSellerId,
          refundedItemIds: refund.itemIds,
        },
      });
    }
    if (!event.result.ok) {
      await this.handleItemsFailed(event);
    }
    if (order.nextId) {
      const nextOrder = await this.shopOrdersService.findById(order.nextId);
      if (!nextOrder) {
        return this.logger.warn(`Order ${order.nextId} not found.`);
      }
      await this.shopOrdersService.moveToPending(nextOrder);
    }
  }

  async handleItemsFailed(event: ItemTransactionFailedEvent): Promise<void> {}
}

interface AuthorizedPayload {
  userId: string;
  robloUserId: number;
  roblosecurity: string;
  totpSecret?: string;
}

interface ListItemsPayload extends AuthorizedPayload {
  rate?: number;
  rates?: [number, number][]; // assetId -> rate
  itemIds: number[];
}

interface OrderItemsPayload extends AuthorizedPayload {
  itemIds: number[];
}

interface BuyItemsPayload extends OrderItemsPayload {
  smallItemId: number;
}

interface UnlistItemsPayload {
  userId: string;
  itemIds: number[];
}

interface EditItemRatePayload {
  userId: string;
  itemId: number;
  newRate: number;
}
