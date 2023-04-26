import { Injectable } from "@nestjs/common";
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter";

import { pickBy } from "../../common/util/array.util.js";
import type { ShopDbItem } from "../../items/db_items/db_item.entity.js";
import { DbItemsService } from "../../items/db_items/db_items.service.js";
import { WalletService } from "../../wallet/wallet.service.js";
import { PlaceSellOrderEvent } from "../shop_sell_orders/events/place_sell_order.event.js";
import {
  SHOP_ITEMS_LISTED_EVENT,
  SHOP_ITEMS_PREPARED_EVENT,
} from "../shop.constants.js";
import { ShopBuyOrdersService } from "./shop_buy_orders.service.js";

@Injectable()
export class ShopBuyOrdersEventHost {
  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly dbItemsService: DbItemsService,
    private readonly walletService: WalletService,
    private readonly shopBuyOrdersService: ShopBuyOrdersService
  ) {}

  @OnEvent(SHOP_ITEMS_PREPARED_EVENT)
  async onItemsPrepared(items: ShopDbItem[]): Promise<void> {
    /*const assetIds = pickBy(items, "assetId");
    const orders = await this.shopBuyOrdersService.findByAssetIds(assetIds);
    const orderedItemIds: number[] = [];
    if (orders.length > 0) {
      const events = new Map<string, PlaceSellOrderEvent>();
      for (const order of orders) {
        const index = items.findIndex((item) => item.assetId === order.assetId);
        if (index === -1) {
          continue;
        }
        const [item] = items.splice(index, 1);
        orderedItemIds.push(item._id);
        const key = `User_${order.buyerId}->RobloUser_${item.robloUserId}`;
        let event = events.get(key);
        if (!event) {
          event = new PlaceSellOrderEvent({
            buyerId: order.buyerId,
            robloBuyerId: order.robloBuyerId,
            robloSellerId: item.robloUserId,
            expectedCost: 0,
            expectedSellerIds: [],
            expectedPrices: [],
            itemIds: [],
          });
        }
        event.expectedCost += item.price;
        event.expectedSellerIds.push([item._id, item.userId]);
        event.expectedPrices.push([item._id, item.price]);
        event.itemIds.push(item._id);
      }
      for (const [, event] of events) {
        this.eventEmitter.emit(PlaceSellOrderEvent.EVENT, event);
      }
    }*/
    for (const item of items) {
      item.available = true;
    }
    await this.dbItemsService.createMany(items);
    this.eventEmitter.emit(SHOP_ITEMS_LISTED_EVENT, items);
  }
}
