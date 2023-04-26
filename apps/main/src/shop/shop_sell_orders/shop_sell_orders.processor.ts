import { Injectable, Logger } from "@nestjs/common";

import { DbItemsService } from "../../items/db_items/db_items.service.js";
import { ItemTransactionEvent } from "../../items/item_transactions/enums/item_transaction_event.enum.js";
import { ItemTransactionsService } from "../../items/item_transactions/item_transactions.service.js";
import { ItemsService } from "../../items/items.service.js";
import { ShopUserType } from "../shop_users/enums/shop_user_type.enum.js";
import { ShopUser } from "../shop_users/shop_user.entity.js";
import { ShopUsersService } from "../shop_users/shop_users.service.js";
import { ShopSellOrder } from "./shop_sell_order.entity.js";
import { ShopSellOrdersService } from "./shop_sell_orders.service.js";
import { WorkerHost } from "../../common/classes/worker-host.js";

@Injectable()
export class ShopSellOrdersProcessor extends WorkerHost {
  private readonly logger = new Logger(ShopSellOrdersProcessor.name);

  constructor(
    private readonly dbItemsService: DbItemsService,
    private readonly itemTransactionsService: ItemTransactionsService,
    private readonly itemsService: ItemsService,
    private readonly shopUsersService: ShopUsersService,
    private readonly shopOrdersService: ShopSellOrdersService
  ) {
    super();
  }

  async process() {
    if (this.alive) {
      try {
        await this.processPending();
      } catch (error) {
        console.error(error);
      }
      setTimeout(() => this.process(), 1000);
    }
  }

  async processPending(): Promise<void> {
    const orders = await this.shopOrdersService.findPending();
    if (orders.length === 0) {
      return;
    }
    for (const order of orders) {
      await this.processOrder(order);
    }
  }

  private async processOrder(order: ShopSellOrder): Promise<void> {
    try {
      const buyer = await this.prepareUser(
        ShopUserType.Buyer,
        order.robloBuyerId
      );
      const seller = await this.prepareUser(
        ShopUserType.Seller,
        order.robloSellerId
      );
      const transaction = this.itemTransactionsService.prepareWithdraw({
        userId: order.buyerId,
        event: ItemTransactionEvent.Shop_Withdraw,
        receiver: {
          id: buyer.user._id,
          roblosecurity: buyer.user.credentials.roblosecurity,
          roblosecret: buyer.user.credentials.roblosecret,
          userAssetIds: [],
          recyclableUserAssetIds: [buyer.small.userAssetId],
        },
        senders: [
          {
            id: seller.user._id,
            roblosecurity: seller.user.credentials.roblosecurity,
            roblosecret: seller.user.credentials.roblosecret,
            userAssetIds: order.itemIds,
            recyclableUserAssetIds: [seller.small.userAssetId],
          },
        ],
      });
      order.itemTransactionId = transaction._id;
      await this.itemTransactionsService.add(transaction);
      await this.itemTransactionsService.activate(transaction);
      await this.shopOrdersService.moveToProcessed(order);
    } catch (error) {
      await this.shopOrdersService.moveToCancelled(order);
      if (order.nextOrderId) {
        const nextOrder = await this.shopOrdersService.findById(
          order.nextOrderId
        );
        if (nextOrder) {
          await this.shopOrdersService.moveToPending(order);
        } else {
          this.logger.error(
            `FATAL: Next order ${order.nextOrderId} not found.`
          );
        }
      }
      await this.dbItemsService.setItemsAvailable(true, order.itemIds);
      this.logger.error(error);
    }
  }

  private async prepareUser(
    type: ShopUserType,
    userId: number
  ): Promise<PrepareUserResult> {
    const user = await this.shopUsersService.findByIdAndType(type, userId);
    if (!user) {
      throw new Error("User not found.");
    }
    if (!user.enabled) {
      throw new Error("User is not enabled.");
    }
    if (!user.authenticated) {
      throw new Error("User is not authenticated.");
    }
    if (user.moderated) {
      throw new Error("User is moderated.");
    }
    if (user.frictioned) {
      throw new Error("User must complete trade two-step verification.");
    }
    const valid = await this.validateUser(user);
    if (!valid) {
      throw new Error("User cannot trade.");
    }
    try {
      const small = await this.itemsService.prepareSmall(userId);
      return { user, small };
    } catch {
      throw new Error("User does not have a small to trade.");
    }
  }

  private async validateUser(user: ShopUser): Promise<boolean> {
    const result = await this.itemsService.canUseItems(
      user.credentials.roblosecurity
    );
    if (result.ok === false && result.error === "unauthorized") {
      user.enabled = false;
      user.authenticated = false;
      await this.shopUsersService.save(user);
      throw new Error(
        "User has been disabled because they are no longer authenticated."
      );
    }
    return result.ok;
  }
}

interface PrepareUserResult {
  user: ShopUser;
  small: Awaited<ReturnType<ItemsService["prepareSmall"]>>;
}
