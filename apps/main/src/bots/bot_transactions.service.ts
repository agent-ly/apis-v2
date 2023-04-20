import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { RedisUtilService } from "nestjs-super-redis/util";

import { pickBy, toUnique } from "../common/util/array.util.js";
import { DbItemType } from "../items/db_items/enums/db_item_type.enum.js";
import { DbItemsService } from "../items/db_items/db_items.service.js";
import { ItemReserveType } from "../items/item_reserves/enums/item_reserve_type.enum.js";
import { ItemReservesStorage } from "../items/item_reserves/item_reserves.storage.js";
import { ItemTransactionType } from "../items/item_transactions/enums/item_transaction_type.enum.js";
import { ItemTransactionEvent } from "../items/item_transactions/enums/item_transaction_event.enum.js";
import { ItemTransactionProcessedEvent } from "../items/item_transactions/events/item_transaction_processed.event.js";
import { ITEM_TRANSACTION_PROCESSED_EVENT } from "../items/item_transactions/item_transactions.constants.js";
import { ItemTransactionsService } from "../items/item_transactions/item_transactions.service.js";
import { ItemsService } from "../items/items.service.js";
import { BotsService } from "./bots.service.js";

@Injectable()
export class BotTransactionsService {
  private static readonly DEPOSIT_EVENT = `${ITEM_TRANSACTION_PROCESSED_EVENT}.${ItemTransactionEvent.Bot_Deposit}`;
  private static readonly WITHDRAW_EVENT = `${ITEM_TRANSACTION_PROCESSED_EVENT}.${ItemTransactionEvent.Bot_Withdraw}`;

  private readonly logger = new Logger(BotTransactionsService.name);

  constructor(
    private readonly redisUtilService: RedisUtilService,
    private readonly dbItemsService: DbItemsService,
    private readonly itemReservesStorage: ItemReservesStorage,
    private readonly itemTransactionsService: ItemTransactionsService,
    private readonly itemsService: ItemsService,
    private readonly botsService: BotsService
  ) {}

  async depositItems(payload: TransactItemsPayload): Promise<void> {
    const lockTime = 1e3 * 30;
    const lockKey = `bot_items:depositing:${payload.robloUserId}`;
    const locked = await this.redisUtilService.withLock(lockKey, lockTime, () =>
      this.handleDepositItems(payload)
    );
    if (locked === null) {
      throw new BadRequestException({
        error: "depositing_already",
        message: "You are already depositing items.",
      });
    }
  }

  async withdrawItems(payload: TransactItemsPayload): Promise<void> {
    await this.handleWithdrawItems(payload);
  }

  async handleDepositItems(payload: TransactItemsPayload): Promise<void> {
    const bot = await this.botsService.findBotForDeposit(payload.robloUserId);
    if (!bot) {
      throw new BadRequestException({
        error: "no_bots_available",
        message: "No bots are available for deposit.",
      });
    }
    const { items, small } = await this.itemsService.prepareItems(
      payload.robloUserId,
      payload.itemIds,
      payload.smallItemId
    );
    const itemIds = pickBy(items, "id");
    const botSmall = await this.itemsService.prepareSmall(bot._id);
    if (!botSmall) {
      throw new BadRequestException({
        error: "bot_no_smalls",
        message:
          "The bot selected for you deposit now has no smalls available, please try again.",
      });
    }
    const smallItemIds = [small.userAssetId, botSmall.userAssetId];
    this.itemReservesStorage.add(ItemReserveType.Items, itemIds);
    this.itemReservesStorage.add(ItemReserveType.Smalls, smallItemIds);
    try {
      const itemTransaction = await this.itemTransactionsService.create({
        userId: payload.userId,
        type: ItemTransactionType.Deposit,
        event: ItemTransactionEvent.Bot_Deposit,
        sender: {
          id: payload.robloUserId,
          roblosecurity: payload.roblosecurity,
          userAssetIds: itemIds,
          recyclableUserAssetIds: [small.userAssetId],
        },
        receiver: {
          id: bot._id,
          roblosecurity: bot.credentials.roblosecurity,
          totpSecret: bot.credentials.totpSecret,
          userAssetIds: [],
          recyclableUserAssetIds: [botSmall.userAssetId],
        },
        details: payload.details,
      });
      await this.itemTransactionsService.activate(itemTransaction);
    } catch (error) {
      this.itemReservesStorage.remove(ItemReserveType.Items, itemIds);
      this.itemReservesStorage.remove(ItemReserveType.Smalls, smallItemIds);
      throw error;
    }
  }

  async handleWithdrawItems(payload: TransactItemsPayload): Promise<void> {
    /*const items = await this.dbItemsService.findManyByType(DbItemType.Bot, {
      userId: payload.userId,
      _id: { $in: payload.itemIds },
    });
    this.dbItemsService.areItemsAvailable(payload.itemIds, items);
    await this.dbItemsService.setItemsAvailable(payload.itemIds, false);
    const botIds = toUnique(pickBy(items, "botId"));
    const bot = await this.botsService.findBotForWithdraw(
      payload.robloUserId,
      botIds
    );
    if (!bot) {
      throw new BadRequestException({
        error: "no_bots_available",
        message: "No bots are available for withdraw.",
        details: { botIds },
      });
    }
    const { currentItemIds, nextItemIds } = items.reduce(
      (acc, { _id, botId }) => {
        if (botId === bot._id) {
          acc.currentItemIds.push(_id);
        } else {
          acc.nextItemIds.push(_id);
        }
        return acc;
      },
      { currentItemIds: [] as number[], nextItemIds: [] as number[] }
    );
    const small = await this.itemsService.prepareSmall(
      payload.robloUserId,
      true
    );
    const botSmall = await this.itemsService.prepareSmall(bot._id);
    if (!botSmall) {
      throw new BadRequestException({
        error: "bot_no_smalls",
        message: "Bot has no smalls available.",
      });
    }
    const smallItemIds = [small.userAssetId, botSmall.userAssetId];
    this.itemReservesStorage.add(ItemReserveType.Items, currentItemIds);
    this.itemReservesStorage.add(ItemReserveType.Smalls, smallItemIds);
    try {
      let details: BotTransactionDetails | undefined;
      if (nextItemIds) {
        const data = this.itemTransactionsService.encryptCredentials({
          roblosecurity: payload.roblosecurity,
          totpSecret: payload.totpSecret,
        });
        details = { data, nextItemIds };
      }
      await this.itemTransactionsService.add({
        userId: payload.userId,
        type: ItemTransactionType.Withdraw,
        event: ItemTransactionEvent.Bot_Withdraw,
        sender: {
          id: bot._id,
          roblosecurity: bot.credentials.roblosecurity,
          totpSecret: bot.credentials.totpSecret,
          userAssetIds: currentItemIds,
          recyclableUserAssetIds: [botSmall.userAssetId],
        },
        receiver: {
          id: payload.robloUserId,
          roblosecurity: payload.roblosecurity,
          userAssetIds: [],
          recyclableUserAssetIds: [small.userAssetId],
        },
        details,
      });
    } catch (error) {
      this.itemReservesStorage.remove(ItemReserveType.Items, currentItemIds);
      this.itemReservesStorage.remove(ItemReserveType.Smalls, smallItemIds);
      throw error;
    }*/
  }

  @OnEvent([
    BotTransactionsService.DEPOSIT_EVENT,
    BotTransactionsService.WITHDRAW_EVENT,
  ])
  async onItemsProcessed(event: ItemTransactionProcessedEvent): Promise<void> {
    this.logger.debug(
      `Bot Transaction completed: Ref ${event.transaction._id}.`
    );
    this.itemReservesStorage.remove(
      ItemReserveType.Items,
      event.result.userAssetIds
    );
    this.itemReservesStorage.remove(
      ItemReserveType.Smalls,
      event.result.recyclableUserAssetIds
    );
    if (event.transaction.type === ItemTransactionType.Deposit) {
      await this.handleItemsDeposited(event);
    } else if (event.transaction.type === ItemTransactionType.Withdraw) {
      await this.handleItemsWithdrawn(event);
    }
  }

  async handleItemsDeposited(
    event: ItemTransactionProcessedEvent
  ): Promise<void> {
    const userId = event.transaction.userId;
    const botId = event.transaction.receiverId;
    const ownership = new Map(event.result.ownershipDetails.userAssetIds);
    const received = ownership.get(botId);
    if (received && received.length > 0) {
      const items = await this.itemsService.getItems(botId);
      const owns = items.filter((item) => received.includes(item.id));
      if (owns.length > 0) {
        const botItems = this.dbItemsService.prepareBotItems({
          userId: userId,
          botId,
          items,
        });
        if (event.result.userAssetIds.length !== owns.length) {
          botItems.forEach((item) => (item.available = true));
        }
        await this.dbItemsService.createMany(botItems);
      }
    }

    if (!event.result.ok) {
      await this.handleItemsFailed(event);
    }
  }

  async handleItemsWithdrawn(
    event: ItemTransactionProcessedEvent
  ): Promise<void> {
    const robloUserId = event.transaction.receiverId;
    const ownership = new Map(event.result.ownershipDetails.userAssetIds);
    const received = ownership.get(robloUserId);
    if (received && received.length > 0) {
      const { deletedCount } = await this.dbItemsService.deleteManyById(
        received
      );
      if (deletedCount !== received.length) {
        // TODO: Implement
      }
    }

    if (!event.result.ok) {
      return this.handleItemsFailed(event);
    }

    // This section handles the orchestation of multiple trades between multiple bots
  }

  async handleItemsFailed(event: ItemTransactionProcessedEvent): Promise<void> {
    const userId = event.transaction.userId;
    const [robloUserId, botId] =
      event.transaction.type === ItemTransactionType.Deposit
        ? [event.transaction.senderId, event.transaction.receiverId]
        : [event.transaction.receiverId, event.transaction.senderId];
    if (!event.result.error) {
      return this.logger.warn(
        `Bot Transaction failed without error: Ref ${event.transaction._id}`
      );
    }
    if (event.result.error.field === "userId") {
      if (event.result.error.fieldData === botId) {
        // TODO: Handle bot errors
      } else {
        // TODO: Handle user errors
      }
    }
  }
}

interface TransactItemsPayload {
  userId: string;
  robloUserId: number;
  roblosecurity: string;
  totpSecret?: string;
  itemIds: number[];
  smallItemId?: number;
  details?: unknown;
}
