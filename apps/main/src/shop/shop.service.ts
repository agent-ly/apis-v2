import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { RedisUtilService } from "nestjs-super-redis/util";

import { sumBy } from "../common/util/array.util.js";
import { toCoins } from "../common/util/format.util.js";
import { TransactionEvent } from "../wallet/transactions/enums/transaction_event.enum.js";
import { WalletService } from "../wallet/wallet.service.js";
import { DbItemType } from "../items/db_items/enums/db_item_type.enum.js";
import type { ShopDbItem } from "../items/db_items/db_item.entity.js";
import { DbItemsService } from "../items/db_items/db_items.service.js";
import { ItemReserveType } from "../items/item_reserves/enums/item_reserve_type.enum.js";
import { ItemReservesStorage } from "../items/item_reserves/item_reserves.storage.js";
import { ItemsService } from "../items/items.service.js";
import { ShopUserType } from "./shop_users/enums/shop_user_type.enum.js";
import { ShopUsersService } from "./shop_users/shop_users.service.js";
import { ShopBuyOrdersService } from "./shop_buy_orders/shop_buy_orders.service.js";
import { ShopSellOrder } from "./shop_sell_orders/shop_sell_order.entity.js";
import {
  PlaceOrderPayload,
  ShopSellOrdersService,
} from "./shop_sell_orders/shop_sell_orders.service.js";
import {
  SHOP_ITEMS_AVAILABLE_EVENT,
  SHOP_ITEMS_EDITED_EVENT,
  SHOP_ITEMS_PREPARED_EVENT,
  SHOP_ITEMS_UNAVAILABLE_EVENT,
  SHOP_ITEMS_UNLISTED_EVENT,
} from "./shop.constants.js";

@Injectable()
export class ShopService {
  private readonly logger = new Logger(ShopService.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly redisUtilService: RedisUtilService,
    private readonly dbItemsService: DbItemsService,
    private readonly itemReservesStorage: ItemReservesStorage,
    private readonly itemsService: ItemsService,
    private readonly walletService: WalletService,
    private readonly shopUsersService: ShopUsersService,
    private readonly shopBuyOrdersService: ShopBuyOrdersService,
    private readonly shopSellOrdersService: ShopSellOrdersService
  ) {}

  async getItems(): Promise<ShopDbItem[]> {
    const items = await this.dbItemsService.findManyByType(
      DbItemType.Shop,
      { available: true },
      {
        projection: {
          robloUserId: 0,
          type: 0,
          available: 0,
          details: 0,
        },
      }
    );
    return items;
  }

  async listItems(payload: ListItemsPayload): Promise<void> {
    // TODO: Protect with captcha
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

  async buyItems(payload: BuyItemsPayload): Promise<void> {
    // TODO: Protect with captcha
    const lockKey = `shop:ordering_or_buying_items:${payload.userId}`;
    const lockTtl = 30;
    const locked = await this.redisUtilService.withLock(lockKey, lockTtl, () =>
      this.handleBuyItems(payload)
    );
    if (locked === null) {
      throw new BadRequestException({
        error: "already_buying_items",
        message: "You are already buying items.",
      });
    }
  }

  /*async orderItems(payload: OrderItemsPayload): Promise<void> {
    // TODO: Protect with captcha
    const lockKey = `shop:ordering_or_buying_items:${payload.userId}`;
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
  }*/

  private async handleListItems(payload: ListItemsPayload): Promise<void> {
    const result = await this.itemsService.canUseItems(payload.roblosecurity);
    if (!result.ok) {
      throw new BadRequestException({
        error: "cannot_use_items",
        message: result.error,
      });
    }
    const itemIds = [...new Set(payload.itemIds)];
    const items = await this.itemsService.getItems(
      payload.robloUserId,
      true,
      itemIds
    );
    const rates = payload.rates ? new Map(payload.rates) : undefined;
    const shopItems = this.dbItemsService.prepareShopItems({
      userId: payload.userId,
      robloUserId: payload.robloUserId,
      rate: payload.rate,
      rates,
      items,
    });
    await this.shopUsersService.upsert({
      type: ShopUserType.Seller,
      userId: payload.robloUserId,
      roblosecurity: payload.roblosecurity,
      roblosecret: payload.roblosecret,
    });
    this.itemReservesStorage.add(ItemReserveType.Items, itemIds);
    this.eventEmitter.emit(SHOP_ITEMS_PREPARED_EVENT, shopItems);
  }

  private async handleUnlistItems(payload: UnlistItemsPayload): Promise<void> {
    const itemIds = [...new Set(payload.itemIds)];
    const items = await this.dbItemsService.findManyByType(DbItemType.Shop, {
      _id: { $in: itemIds },
    });
    const owns = items.every((item) => item.userId === payload.userId);
    if (!owns) {
      throw new UnauthorizedException({
        error: "not_owner",
        message: "You do not own all of the items you are trying to unlist.",
      });
    }
    this.dbItemsService.areItemsAvailable(itemIds, items);
    await this.dbItemsService.deleteManyById(itemIds);
    await this.itemReservesStorage.remove(ItemReserveType.Items, itemIds);
    this.eventEmitter.emit(SHOP_ITEMS_UNLISTED_EVENT, itemIds);
  }

  private async handleEditItemRate(
    payload: EditItemRatePayload
  ): Promise<void> {
    const item = await this.dbItemsService.findOneByType(DbItemType.Shop, {
      _id: payload.itemId,
    });
    if (!item) {
      throw new NotFoundException({
        error: "item_not_found",
        message: "Item not found.",
      });
    }
    if (payload.userId !== item.userId) {
      throw new UnauthorizedException({
        error: "not_owner",
        message: "You do not own this item.",
      });
    }
    if (!item.available) {
      throw new BadRequestException({
        error: "item_not_available",
        message: "Item not available.",
      });
    }
    const newPrice = toCoins(item.value, payload.newRate);
    if (payload.expectedNewPrice !== newPrice) {
      throw new BadRequestException({
        error: "price_mismatch",
        message: "The new price does not match the expected new price.",
      });
    }
    const { modifiedCount } = await this.dbItemsService.updateOneByType(
      DbItemType.Shop,
      { _id: payload.itemId, available: true },
      {
        $set: { price: newPrice, rate: payload.newRate },
        $currentDate: { updatedAt: true },
      }
    );
    if (modifiedCount === 0) {
      throw new BadRequestException({
        error: "item_not_available",
        message: "Item not available.",
      });
    }
    const event = {
      itemId: payload.itemId,
      newRate: payload.newRate,
      newPrice,
    };
    this.eventEmitter.emit(SHOP_ITEMS_EDITED_EVENT, event);
  }

  private async handleBuyItems(payload: BuyItemsPayload): Promise<void> {
    const result = await this.itemsService.canUseItems(payload.roblosecurity);
    if (!result.ok) {
      throw new BadRequestException({
        error: "cannot_use_items",
        message: result.error,
      });
    }
    const itemIds = [...new Set(payload.itemIds)];
    const items = await this.dbItemsService.findManyByType(DbItemType.Shop, {
      _id: { $in: itemIds },
    });
    this.dbItemsService.areItemsAvailable(itemIds, items);
    const totalExpectedCost = sumBy(items, "price");
    await this.walletService.hasBalance(payload.userId, totalExpectedCost);
    await this.dbItemsService.setItemsAvailable(false, itemIds);
    this.eventEmitter.emit(SHOP_ITEMS_UNAVAILABLE_EVENT, itemIds);
    let purchased = false;
    try {
      const expectedPrices = new Map(payload.expectedPrices);
      const expectedSellerIds = new Map(payload.expectedSellerIds);
      const sellOrderPayloads = new Map<
        number,
        Omit<PlaceOrderPayload, "transactionId">
      >();
      for (const item of items) {
        if (payload.userId === item.userId) {
          throw new BadRequestException({
            error: "cannot_buy_own_items",
            message: "You cannot buy your own items.",
          });
        }
        const expectedPrice = expectedPrices.get(item._id);
        if (expectedPrice !== item.price) {
          throw new BadRequestException({
            error: "price_mismatch",
            message: "The price of an item has changed.",
            details: {
              itemId: item._id,
              expectedPrice,
              actualPrice: item.price,
            },
          });
        }
        const expectedSellerId = expectedSellerIds.get(item._id);
        if (expectedSellerId !== item.userId) {
          throw new BadRequestException({
            error: "seller_mismatch",
            message: "The seller of an item has changed.",
            details: {
              itemId: item._id,
              expectedSellerId,
              actualSellerId: item.robloUserId,
            },
          });
        }
        let orderPayload = sellOrderPayloads.get(item.robloUserId);
        if (!orderPayload) {
          orderPayload = {
            buyerId: payload.userId,
            robloBuyerId: payload.robloUserId,
            robloSellerId: item.robloUserId,
            expectedCost: 0,
            expectedPrices: [],
            expectedSellerIds: [],
            itemIds: [],
          };
        }
        orderPayload.expectedCost += item.price;
        orderPayload.expectedPrices.push([item._id, item.price]);
        orderPayload.expectedSellerIds.push([item._id, item.userId]);
        orderPayload.itemIds.push(item._id);
        sellOrderPayloads.set(item.robloUserId, orderPayload);
      }
      const transactionId = await this.walletService.subtractBalance({
        userId: payload.userId,
        event: TransactionEvent.Shop_Buy,
        amount: totalExpectedCost,
        details: { itemIds },
      });
      await this.shopUsersService.upsert({
        type: ShopUserType.Buyer,
        userId: payload.robloUserId,
        roblosecurity: payload.roblosecurity,
        roblosecret: payload.roblosecret,
      });
      purchased = true;
      const orders: ShopSellOrder[] = [];
      for (const [, sellOrderPayload] of sellOrderPayloads) {
        const order = this.shopSellOrdersService.prepare({
          transactionId,
          ...sellOrderPayload,
        });
        const previousOrder = orders[orders.length - 1];
        if (previousOrder) {
          previousOrder.nextOrderId = order._id;
        }
        await this.shopSellOrdersService.add(order);
        orders.push(order);
      }
      await this.shopSellOrdersService.moveToPending(orders[0]);
    } catch (error) {
      await this.dbItemsService.setItemsAvailable(true, itemIds);
      this.eventEmitter.emit(SHOP_ITEMS_AVAILABLE_EVENT, itemIds);
      if (purchased) {
        await this.walletService.addBalance({
          userId: payload.userId,
          event: TransactionEvent.Shop_Refund,
          amount: totalExpectedCost,
          details: { error: (error as Error).message },
        });
      }
      throw error;
    }
  }

  /*private async handleOrderItems(payload: OrderItemsPayload): Promise<void> {
    await this.shopUsersService.upsert({
      type: ShopUserType.Buyer,
      userId: payload.robloUserId,
      roblosecurity: payload.roblosecurity,
      roblosecret: payload.roblosecret,
    });
    await this.shopBuyOrdersService.create({
      buyerId: payload.userId,
      robloBuyerId: payload.robloUserId,
      assetId: payload.assetId,
      minRate: payload.minRate,
      maxRate: payload.maxRate,
    });
  }*/
}

interface AuthorizedPayload {
  userId: string;
  robloUserId: number;
  roblosecurity: string;
  roblosecret?: string;
}

interface ListItemsPayload extends AuthorizedPayload {
  rate?: number;
  rates?: [number, number][]; // item_id -> rate
  itemIds: number[];
}

interface BuyItemsPayload extends AuthorizedPayload {
  expectedPrices: [number, number][]; // item_id -> price
  expectedSellerIds: [number, string][]; // item_id -> seller_id
  itemIds: number[];
}

/*interface OrderItemsPayload extends AuthorizedPayload {
  assetId: number;
  minRate: number;
  maxRate: number;
}*/

interface UnlistItemsPayload {
  userId: string;
  itemIds: number[];
}

interface EditItemRatePayload {
  userId: string;
  itemId: number;
  newRate: number;
  expectedNewPrice: number;
}
