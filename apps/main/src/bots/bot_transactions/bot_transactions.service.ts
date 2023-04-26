import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { RedisUtilService } from "nestjs-super-redis/util";

import { groupAllBy, pickBy } from "../../common/util/array.util.js";
import { DbItemType } from "../../items/db_items/enums/db_item_type.enum.js";
import { DbItemsService } from "../../items/db_items/db_items.service.js";
import { ItemReserveType } from "../../items/item_reserves/enums/item_reserve_type.enum.js";
import { ItemReservesStorage } from "../../items/item_reserves/item_reserves.storage.js";
import { ItemTransactionEvent } from "../../items/item_transactions/enums/item_transaction_event.enum.js";
import {
  ItemTransactionsService,
  type CreateItemTransactionUser,
} from "../../items/item_transactions/item_transactions.service.js";
import { ItemsService } from "../../items/items.service.js";
import { BotsService } from "../bots.service.js";

@Injectable()
export class BotTransactionsService {
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
    const lockTime = 1e3 * 30;
    const lockKey = `bot_items:withdrawing:${payload.robloUserId}`;
    const locked = await this.redisUtilService.withLock(lockKey, lockTime, () =>
      this.handleWithdrawItems(true, payload)
    );
    if (locked === null) {
      throw new BadRequestException({
        error: "withdrawing_already",
        message: "You are already withdrawing items.",
      });
    }
  }

  async withdrawItemsAsync(payload: TransactItemsPayload): Promise<void> {
    await this.handleWithdrawItems(false, payload);
  }

  async handleDepositItems(payload: TransactItemsPayload): Promise<void> {
    const bot = await this.botsService.findBotForDeposit(payload.robloUserId);
    if (!bot) {
      throw new BadRequestException({
        error: "no_bots_available",
        message: "No bots are available for this deposit.",
      });
    }
    const { items, small } = await this.itemsService.prepareItems(
      payload.robloUserId,
      payload.itemIds,
      payload.smallItemId
    );
    const itemIds = pickBy(items, "id");
    let botSmall: Awaited<ReturnType<ItemsService["prepareSmall"]>>;
    try {
      botSmall = await this.itemsService.prepareSmall(bot._id);
    } catch {
      throw new BadRequestException({
        error: "bot_no_smalls",
        message:
          "The bot selected for you deposit now has no smalls available, please try again.",
      });
    }
    const smallItemIds = [small.userAssetId, botSmall.userAssetId];
    await this.itemReservesStorage.add(ItemReserveType.Items, itemIds);
    await this.itemReservesStorage.add(ItemReserveType.Smalls, smallItemIds);
    try {
      const transaction = this.itemTransactionsService.prepareDeposit({
        userId: payload.userId,
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
          roblosecret: bot.credentials.roblosecret,
          userAssetIds: [],
          recyclableUserAssetIds: [botSmall.userAssetId],
        },
        details: payload.details,
      });
      console.dir(transaction, { depth: null });
      await this.itemTransactionsService.add(transaction);
      await this.itemTransactionsService.activate(transaction);
      this.logger.log(`Deposit transaction activated: ${transaction._id}`);
    } catch (error) {
      console.error(error);
      await this.itemReservesStorage.remove(ItemReserveType.Items, itemIds);
      await this.itemReservesStorage.remove(
        ItemReserveType.Smalls,
        smallItemIds
      );
      throw new BadRequestException({
        error: "deposit_failed",
        message: "The deposit failed, please try again.",
      });
    }
  }

  async handleWithdrawItems(
    throws: boolean,
    payload: TransactItemsPayload
  ): Promise<void> {
    const items = await this.dbItemsService.findManyByType(DbItemType.Bot, {
      userId: payload.userId,
      _id: { $in: payload.itemIds },
    });
    this.dbItemsService.areItemsAvailable(payload.itemIds, items);
    await this.dbItemsService.setItemsAvailable(false, payload.itemIds);
    try {
      const itemsByBotId = groupAllBy(items, "botId");
      const botIds = [...itemsByBotId.keys()];
      const bots = await this.botsService.findBotsForWithdraw(
        payload.robloUserId,
        botIds
      );
      if (bots.length === 0) {
        throw new BadRequestException({
          error: "no_bots_available",
          message: "No bots are available for this deposit.",
        });
      }
      if (bots.length < botIds.length) {
        throw new BadRequestException({
          error: "bots_unavailable",
          message: "Some bots are unavailable for this withdraw.",
        });
      }
      const small = await this.itemsService.prepareSmall(
        payload.robloUserId,
        payload.smallItemId
      );
      const totalItemIds: number[] = [],
        totalSmallItemIds: number[] = [small.userAssetId];
      const senders: CreateItemTransactionUser[] = [];
      for (const bot of bots) {
        const items = itemsByBotId.get(bot._id)!;
        try {
          const small = await this.itemsService.prepareSmall(bot._id);
          const itemIds = pickBy(items, "_id");
          const sender: CreateItemTransactionUser = {
            id: bot._id,
            roblosecurity: bot.credentials.roblosecurity,
            roblosecret: bot.credentials.roblosecret,
            userAssetIds: itemIds,
            recyclableUserAssetIds: [small.userAssetId],
          };
          senders.push(sender);
          totalItemIds.push(...itemIds);
          totalSmallItemIds.push(small.userAssetId);
        } catch {
          throw new BadRequestException({
            error: "bot_no_smalls",
            message:
              "A bot selected for you withdraw now has no smalls available, please try again.",
          });
        }
      }
      this.itemReservesStorage.add(ItemReserveType.Smalls, totalSmallItemIds);
      try {
        const transaction = this.itemTransactionsService.prepareWithdraw({
          userId: payload.userId,
          event: ItemTransactionEvent.Bot_Withdraw,
          receiver: {
            id: payload.robloUserId,
            roblosecurity: payload.roblosecurity,
            userAssetIds: [],
            recyclableUserAssetIds: [small.userAssetId],
          },
          senders,
        });
        await this.itemTransactionsService.add(transaction);
        await this.itemTransactionsService.activate(transaction);
        this.logger.log(`Withdraw transaction activated: ${transaction._id}`);
      } catch (error) {
        this.itemReservesStorage.remove(
          ItemReserveType.Smalls,
          totalSmallItemIds
        );
        throw error;
      }
    } catch (error) {
      await this.dbItemsService.setItemsAvailable(true, payload.itemIds);
      if (throws) {
        throw error;
      }
    }
  }
}

interface TransactItemsPayload {
  userId: string;
  robloUserId: number;
  roblosecurity: string;
  roblosecret?: string;
  itemIds: number[];
  smallItemId?: number;
  details?: unknown;
}
