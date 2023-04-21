import { Injectable } from "@nestjs/common";

import { sleep } from "../../common/util/sleep.util.js";
import type { Collectible } from "../../roblox/roblox.interfaces.js";
import { ItemTransactionType } from "../../items/item_transactions/enums/item_transaction_type.enum.js";
import { ItemTransactionEvent } from "../../items/item_transactions/enums/item_transaction_event.enum.js";
import { ItemTransactionsService } from "../../items/item_transactions/item_transactions.service.js";
import { ItemsService } from "../../items/items.service.js";
import { ShopUser } from "../shop_users/shop_user.entity.js";
import { ShopUsersService } from "../shop_users/shop_users.service.js";
import { ShopOrder } from "./shop_order.entity.js";
import { ShopOrdersService } from "./shop_orders.service.js";

@Injectable()
export class ShopOrderWorker {
  constructor(
    private readonly itemTransactionsService: ItemTransactionsService,
    private readonly itemsService: ItemsService,
    private readonly shopUsersService: ShopUsersService,
    private readonly shopOrdersService: ShopOrdersService
  ) {}

  onModuleInit(): void {
    this.process();
  }

  async process(): Promise<void> {
    while (true) {
      // FIFO - First In First Out
      const shopOrders = await this.shopOrdersService.findPending();
      if (shopOrders.length === 0) {
        await sleep(3e4);
        continue;
      }
      for (const shopOrder of shopOrders) {
        await this.processOrder(shopOrder);
      }
    }
  }

  private async processOrder(order: ShopOrder): Promise<void> {
    try {
      const buyer = await this.prepareUser(order.robloBuyerId);
      const seller = await this.prepareUser(order.robloSellerId);
      const transaction = this.itemTransactionsService.create({
        userId: order.buyerId,
        type: ItemTransactionType.Withdraw,
        event: ItemTransactionEvent.Shop_Withdraw,
        sender: {
          id: buyer.user._id,
          roblosecurity: seller.user.credentials.roblosecurity,
          totpSecret: seller.user.credentials.totpSecret,
          userAssetIds: order.itemIds,
          recyclableUserAssetIds: [seller.small.userAssetId],
        },
        receiver: {
          id: seller.user._id,
          roblosecurity: buyer.user.credentials.roblosecurity,
          totpSecret: buyer.user.credentials.totpSecret,
          userAssetIds: [],
          recyclableUserAssetIds: [buyer.small.userAssetId],
        },
      });
      order.transactionId = transaction._id;
      await this.itemTransactionsService.add(transaction);
      await this.itemTransactionsService.activate(transaction);
      await this.shopOrdersService.moveToProcessed(order);
    } catch (error) {
      await this.shopOrdersService.moveToCancelled(order);
      console.error(error);
    }
  }

  private async prepareUser(userId: number): Promise<PrepareUserResult> {
    const user = await this.shopUsersService.findById(userId);
    if (!user) {
      throw new Error("User not found.");
    }
    if (!user.enabled) {
      throw new Error("User is disabled.");
    }
    const valid = await this.validateUser(user);
    if (!valid) {
      throw new Error("User cannot trade.");
    }
    const small = await this.itemsService.prepareSmall(userId);
    if (!small) {
      throw new Error("User does not have a small to trade.");
    }
    return { user, small };
  }

  private async validateUser(user: ShopUser): Promise<boolean> {
    const result = await this.itemsService.canUseItems(
      user.credentials.roblosecurity
    );
    if (result.ok === false && result.error === "unauthorized") {
      user.enabled = false;
      user.authenticated = false;
      await this.shopUsersService.save(user);
      throw new Error("User is not authenticated.");
    }
    return result.ok;
  }
}

interface PrepareUserResult {
  user: ShopUser;
  small: Collectible;
}
