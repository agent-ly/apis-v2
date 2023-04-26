import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter";

import { DbItemsService } from "../../items/db_items/db_items.service.js";
import { ItemReserveType } from "../../items/item_reserves/enums/item_reserve_type.enum.js";
import { ItemReservesStorage } from "../../items/item_reserves/item_reserves.storage.js";
import { ItemTransactionEvent } from "../../items/item_transactions/enums/item_transaction_event.enum.js";
import type {
  DepositItemTransaction,
  WithdrawItemTransaction,
} from "../../items/item_transactions/item_transaction.entity.js";
import { ItemTransactionProcessedEvent } from "../../items/item_transactions/events/item_transaction_processed.event.js";
import { ItemsService } from "../../items/items.service.js";
import { BOT_FEES_COLLECTED_EVENT } from "../bots.constants.js";

@Injectable()
export class BotTransactionsEventHost {
  private static readonly DEPOSIT_EVENT = ItemTransactionProcessedEvent.getName(
    ItemTransactionEvent.Bot_Deposit
  );
  private static readonly WITHDRAW_EVENT =
    ItemTransactionProcessedEvent.getName(ItemTransactionEvent.Bot_Withdraw);

  private readonly logger = new Logger(BotTransactionsEventHost.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly dbItemsService: DbItemsService,
    private readonly itemReservesStorage: ItemReservesStorage,
    private readonly itemsService: ItemsService
  ) {}

  @OnEvent(BotTransactionsEventHost.DEPOSIT_EVENT)
  @OnEvent(BotTransactionsEventHost.WITHDRAW_EVENT)
  async onItemsProcessed(event: ItemTransactionProcessedEvent): Promise<void> {
    this.logger.debug(`Bot Transaction ${event.transaction._id} processed.`);
    await this.itemReservesStorage.remove(
      ItemReserveType.Smalls,
      event.result.recyclableUserAssetIds
    );
    if (event.transaction.event === ItemTransactionEvent.Bot_Deposit) {
      await this.itemReservesStorage.remove(
        ItemReserveType.Items,
        event.result.userAssetIds
      );
      await this.handleItemsDeposited(
        event as ItemTransactionProcessedEvent<DepositItemTransaction>
      );
    } else if (event.transaction.event === ItemTransactionEvent.Bot_Withdraw) {
      await this.handleItemsWithdrawn(
        event as ItemTransactionProcessedEvent<WithdrawItemTransaction>
      );
    }
  }

  async handleItemsDeposited(
    event: ItemTransactionProcessedEvent<DepositItemTransaction>
  ): Promise<void> {
    const userId = event.transaction.userId;
    const botId = event.transaction.robloReceiverId;
    const ownership = new Map(event.result.ownershipDetails.userAssetIds);
    const received = ownership.get(botId);
    if (received && received.length > 0) {
      // ? Relying on their inventory could be troublesome,
      // If issues arise persist the items in the transaction.
      const source = await this.itemsService.getItems(botId);
      const items = source.filter((item) => received.includes(item.id));
      if (items.length > 0) {
        const botItems = this.dbItemsService.prepareBotItems({
          userId,
          botId,
          items,
        });
        if (event.result.userAssetIds.length !== items.length) {
          botItems.forEach((item) => (item.available = true));
        }
        await this.dbItemsService.createMany(botItems);
      } else {
        this.logger.warn(
          `Bot Transaction ${event.transaction._id} failed to find items in inventory.`
        );
      }
    }
    if (!event.result.ok) {
      await this.handleItemsFailed(event);
    }
  }

  async handleItemsWithdrawn(
    event: ItemTransactionProcessedEvent<WithdrawItemTransaction>
  ): Promise<void> {
    const robloUserId = event.transaction.robloUserId;
    const ownership = new Map(event.result.ownershipDetails.userAssetIds);
    const received = ownership.get(robloUserId);
    if (received && received.length > 0) {
      const items = await this.dbItemsService.findManyById(received);
      const feeItems = items.filter((item) => item.userId === "house");
      if (feeItems.length > 0) {
        this.eventEmitter.emit(BOT_FEES_COLLECTED_EVENT, feeItems);
      }
      await this.dbItemsService.deleteManyById(received);
    }
    if (event.result.errors.length > 0) {
      return this.handleItemsFailed(event);
    }
  }

  async handleItemsFailed(
    event: ItemTransactionProcessedEvent<
      DepositItemTransaction | WithdrawItemTransaction
    >
  ): Promise<void> {
    const [error] = event.result.errors;
    const userId = event.transaction.userId;
    const robloUserId = event.transaction.robloUserId;
    if (error.field === "userId") {
      if (error.fieldData === userId) {
        // TODO: Handle user errors
      } else {
        // TODO: Handle bot errors
        const botId = error.fieldData;
      }
    }
  }
}
