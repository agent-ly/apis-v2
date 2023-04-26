import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { InjectCollection } from "nestjs-super-mongodb";
import type { Collection } from "mongodb";

import { generateId } from "../common/util/id.util.js";
import { BotItemsService } from "../bots/bot_items/bot_items.service.js";
import { TransactionEvent } from "../wallet/transactions/enums/transaction_event.enum.js";
import { WalletService } from "../wallet/wallet.service.js";
import { WagerCurrency } from "./enums/wager_currency.enum.js";
import { WagerGame } from "./enums/wager_game.enum.js";
import { WagerResult } from "./enums/wager_result.enum.js";
import { WagerStatus } from "./enums/wager_status.enum.js";
import type { WagerProfit } from "./interfaces/wager_profit.interface.js";
import { Wager } from "./wager.entity.js";
import {
  COLLECTION_NAME,
  WAGER_CREATED_EVENT,
  WAGER_CANCELLED_EVENT,
  WAGER_COMPLETED_EVENT,
} from "./wagers.constants.js";

@Injectable()
export class WagersService {
  private readonly logger = new Logger(WagersService.name);

  constructor(
    @InjectCollection(COLLECTION_NAME)
    private readonly collection: Collection<Wager>,
    private readonly eventEmitter: EventEmitter2,
    private readonly walletService: WalletService,
    private readonly botItemsService: BotItemsService
  ) {}

  async findById<TDetails = unknown>(id: string): Promise<Wager<TDetails>> {
    const wager = await this.collection.findOne({ _id: id });
    return wager as Wager<TDetails>;
  }

  async create(payload: CreateWagerPayload) {
    const id = generateId();
    const now = new Date();
    const wager: Partial<Wager> = {
      _id: id,
      userId: payload.userId,
      gameId: payload.gameId,
      game: payload.game,
      currency: payload.currency,
      status: undefined,
      amount: undefined,
      result: null,
      profit: null,
      details: null,
      createdAt: now,
      updatedAt: now,
    };
    if (payload.currency === WagerCurrency.Coins) {
      if (payload.userId !== "house") {
        const transactionId = await this.walletService.subtractBalance({
          userId: payload.userId,
          event: TransactionEvent.Wager_Create,
          amount: -payload.amount,
          details: {
            wagerId: wager._id,
            gameId: payload.gameId,
            game: payload.game,
          },
        });
        wager.details = { transactionId };
      }
      wager.status = WagerStatus.Active;
      wager.amount = payload.amount;
      await this.collection.insertOne(wager as Wager);
      this.eventEmitter.emit(WAGER_CREATED_EVENT, wager);
      return { wagerId: id };
    } else if (payload.currency === WagerCurrency.Value) {
      const { value, items } = await this.botItemsService.useItems({
        userId: payload.userId,
        itemIds: payload.itemIds,
        details: {
          gameId: payload.gameId,
          game: payload.game,
        },
      });
      wager.status = WagerStatus.Pending;
      wager.amount = value;
      wager.details = { itemIds: payload.itemIds };
      await this.collection.insertOne(wager as Wager);
      this.eventEmitter.emit(WAGER_CREATED_EVENT, wager);
      return { wagerId: id, value, items };
    }
  }

  private async save(wager: Wager) {
    wager.updatedAt = new Date();
    await this.collection.updateOne({ _id: wager._id }, { $set: wager });
  }

  async cancel(payload: CancelWagerPayload) {
    try {
      const wager = await this.findById(payload.wagerId);
      if (!wager) {
        return this.logger.warn(`Wager ${payload.wagerId} not found.`);
      }
      if (wager.status !== WagerStatus.Active) {
        return this.logger.warn(`Wager ${payload.wagerId} is not active.`);
      }
      wager.status = WagerStatus.Cancelled;
      await this.save(wager);
      this.eventEmitter.emit(WAGER_CANCELLED_EVENT, wager);
      this.logger.debug(`Wager ${wager._id} has been cancelled.`);
      if (wager.currency === WagerCurrency.Coins) {
        await this.walletService.addBalance({
          userId: wager.userId,
          event: TransactionEvent.Wager_Cancel,
          amount: wager.amount,
          details: {
            gameId: wager.gameId,
            game: wager.game,
          },
        });
      } else if (wager.currency === WagerCurrency.Value) {
        const details = wager.details as { itemIds: number[] };
        await this.botItemsService.returnItems(details.itemIds);
        await this.save(wager);
      }
      this.logger.debug(
        `Refunded User ${wager.userId} for Wager ${wager._id}.`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      this.logger.warn(
        `An error occured while canceling Wager ${payload.wagerId}: ${message}`
      );
    }
  }

  async complete(payload: CompleteWagerPayload) {
    const wager = await this.collection.findOne({ _id: payload.wagerId });
    if (!wager) {
      return this.logger.warn(`Wager ${payload.wagerId} not found.`);
    }
    if (wager.status !== WagerStatus.Active) {
      return this.logger.warn(`Wager ${payload.wagerId} is not active.`);
    }
    wager.status = WagerStatus.Completed;
    wager.result = payload.result;
    wager.profit =
      payload.result === WagerResult.Win
        ? payload.profit
        : wager.currency === WagerCurrency.Coins
        ? { coins: -wager.amount }
        : { value: -wager.amount };
    await this.save(wager);
    this.eventEmitter.emit(WAGER_COMPLETED_EVENT, wager);
    this.logger.debug(`Wager ${wager._id} has been completed.`);
    try {
      if (payload.result === WagerResult.Win) {
        if (payload.profit.coins) {
          const total = wager.amount + payload.profit.coins;
          if (wager.userId === "house") {
            return this.logger.log(`House has won $${total}.`);
          }
          const amount = total - (payload.profit.coinsFee ?? 0);
          await this.walletService.addBalance({
            userId: wager.userId,
            event: TransactionEvent.Wager_Won,
            amount,
            details: {
              wagerId: wager._id,
              gameId: wager.gameId,
              game: wager.game,
            },
          });
        }
        if (payload.feeItemIds) {
          await this.botItemsService.transferItems("house", payload.feeItemIds);
        }
        if (payload.awardItemIds) {
          await this.botItemsService.transferItems(
            wager.userId,
            payload.awardItemIds
          );
          await this.botItemsService.returnItems(payload.awardItemIds);
          await this.save(wager);
        }
        this.logger.debug(
          `Awarded User ${wager.userId} for Wager ${wager._id}.`
        );
      } else if (
        payload.result === WagerResult.Loss &&
        wager.userId === "house"
      ) {
        this.logger.log(`House has lost $${wager.amount}.`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      this.logger.warn(
        `An error occured while finishing Wager ${payload.wagerId}: ${message}`
      );
    }
  }
}

type CreateWagerPayload =
  | {
      userId: string;
      gameId: string;
      game: WagerGame;
    } & (
      | {
          currency: WagerCurrency.Coins;
          amount: number;
        }
      | {
          currency: WagerCurrency.Value;
          itemIds: number[];
        }
    );

interface CancelWagerPayload {
  wagerId: string;
}

type CompleteWagerPayload = {
  wagerId: string;
} & (
  | {
      result: WagerResult.Win;
      profit: WagerProfit;
      awardItemIds?: number[];
      feeItemIds?: number[];
    }
  | {
      result: WagerResult.Loss;
    }
);
