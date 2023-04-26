import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import { groupBy } from "../../common/util/array.util.js";
import { DbItemsService } from "../../items/db_items/db_items.service.js";
import { ItemTransactionEvent } from "../../items/item_transactions/enums/item_transaction_event.enum.js";
import { ItemTransactionProcessedEvent } from "../../items/item_transactions/events/item_transaction_processed.event.js";
import { TransactionEvent } from "../../wallet/transactions/enums/transaction_event.enum.js";
import { WalletService } from "../../wallet/wallet.service.js";
import { ShopSellOrder } from "./shop_sell_order.entity.js";
import { PlaceSellOrderEvent } from "./events/place_sell_order.event.js";
import { ShopSellOrdersService } from "./shop_sell_orders.service.js";

@Injectable()
export class ShopSellOrdersEventHost {
  private static readonly WITHDRAW_EVENT =
    ItemTransactionProcessedEvent.getName(ItemTransactionEvent.Shop_Withdraw);

  private readonly logger = new Logger(ShopSellOrdersEventHost.name);

  constructor(
    private readonly dbItemsService: DbItemsService,
    private readonly walletService: WalletService,
    private readonly shopSellOrdersService: ShopSellOrdersService
  ) {}

  @OnEvent(PlaceSellOrderEvent.EVENT)
  async onPlaceSellOrder(event: PlaceSellOrderEvent): Promise<void> {
    const order = this.shopSellOrdersService.prepare(event as any);
    await this.shopSellOrdersService.add(order);
    await this.shopSellOrdersService.moveToPending(order);
  }

  @OnEvent(ShopSellOrdersEventHost.WITHDRAW_EVENT)
  async onItemsProcessed(event: ItemTransactionProcessedEvent): Promise<void> {
    const order = await this.shopSellOrdersService.findByItemTransactionId(
      event.transaction._id
    );
    if (!order) {
      return this.logger.error(
        `FATAL: Order not found for Item Transaction ${event.transaction._id}.`
      );
    }
    this.logger.debug(`Handling order ${order._id} ...`);
    await this.handleNextOrder(order);
    const ownership = new Map(event.result.ownershipDetails.userAssetIds);
    const received = ownership.get(order.robloBuyerId);
    await this.handleOrder(order, received);
    if (event.result.errors.length > 0) {
      // TODO: Handle errors
    }
    this.logger.debug(`Handled order ${order._id}.`);
  }

  private async handleOrder(order: ShopSellOrder, received?: number[]) {
    const buyerBalance: AmountAndItemIds = { amount: 0, itemIds: [] };
    if (received && received.length > 0) {
      this.logger.debug(`Items received for order ${order._id}.`);
      const receivedItems = await this.dbItemsService.findManyById(received);
      const receivedItemsMap = groupBy(receivedItems, "_id");
      await this.dbItemsService.deleteManyById(received);
      const receivedSet = new Set(received);
      const expectedPrices = new Map(order.expectedPrices);
      const expectedSellerIds = new Map(order.expectedSellerIds);
      const sellerBalances = new Map<string, AmountAndItemIds>();
      const sales: ShopSale[] = [];
      for (const itemId of order.itemIds) {
        const price = expectedPrices.get(itemId);
        const sellerId = expectedSellerIds.get(itemId);
        if (!price) {
          this.logger.warn(`Expected price for item ${itemId} not found.`);
          continue;
        }
        if (!sellerId) {
          this.logger.warn(`Expected seller for item ${itemId} not found.`);
          continue;
        }
        if (receivedSet.has(itemId)) {
          let current = sellerBalances.get(sellerId);
          if (!current) {
            current = {
              amount: 0,
              itemIds: [],
            };
          }
          current.amount += price;
          current.itemIds.push(itemId);
          sellerBalances.set(sellerId, current);
          const item = receivedItemsMap.get(itemId);
          if (!item) {
            this.logger.warn(`Item ${itemId} not found.`);
            continue;
          }
          sales.push({
            buyerId: order.robloBuyerId,
            sellerId: order.robloSellerId,
            itemId: itemId,
            assetId: item.assetId,
            serial: item.serial,
            name: item.name,
            price: price,
          });
        } else {
          buyerBalance.amount += price;
          buyerBalance.itemIds.push(itemId);
        }
      }
      if (sellerBalances.size > 0) {
        const promises = [];
        for (const [sellerId, { amount, itemIds }] of sellerBalances) {
          promises.push(
            this.walletService.addBalance({
              userId: sellerId,
              event: TransactionEvent.Shop_Sold,
              amount,
              details: {
                buyerId: order.robloBuyerId,
                sellerId: order.robloSellerId,
                soldItemIds: itemIds,
              },
            })
          );
        }
        const results = await Promise.allSettled(promises);
        for (const result of results) {
          if (result.status === "rejected") {
            const index = results.indexOf(result);
            const [sellerId, { amount }] = [...sellerBalances][index];
            this.logger.error(
              `Failed to add ${amount} to Seller ${sellerId}'s balance: ${result.reason}`
            );
          }
        }
      }
    } else {
      this.logger.warn(`No items received for order ${order._id}.`);
      buyerBalance.amount = order.expectedCost;
      buyerBalance.itemIds = order.itemIds;
    }
    if (buyerBalance.amount > 0) {
      this.logger.debug(
        `Refunding ${buyerBalance.amount} for order ${order._id}.`
      );
      try {
        await this.walletService.addBalance({
          userId: order.buyerId,
          event: TransactionEvent.Shop_Refund,
          amount: buyerBalance.amount,
          details: {
            buyerId: order.robloBuyerId,
            sellerId: order.robloSellerId,
            missingItemIds: buyerBalance.itemIds,
          },
        });
      } catch (error) {
        this.logger.error(
          `Failed to refund ${buyerBalance.amount} to Buyer ${
            order.buyerId
          }'s balance: ${(error as Error).message}`
        );
      }
    }
  }

  private async handleNextOrder(order: ShopSellOrder) {
    if (!order.nextOrderId) {
      return;
    }
    const nextOrder = await this.shopSellOrdersService.findById(
      order.nextOrderId
    );
    if (nextOrder) {
      await this.shopSellOrdersService.moveToPending(nextOrder);
      this.logger.debug(
        `Order ${nextOrder._id} moved to pending from Order ${order._id}.`
      );
      return;
    }
    this.logger.error(`FATAL: Next order ${order.nextOrderId} not found.`);
  }
}

interface AmountAndItemIds {
  amount: number;
  itemIds: number[];
}

interface ShopSale {
  buyerId: number;
  sellerId: number;
  itemId: number;
  assetId: number;
  serial: number | null;
  name: string;
  price: number;
}
