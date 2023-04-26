import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter";
import { InjectCollection } from "nestjs-super-mongodb";
import type { Collection } from "mongodb";

import { generateId } from "../../common/util/id.util.js";
import { pickBy } from "../../common/util/array.util.js";
import { CryptService } from "../../crypt/crypt.service.js";
import {
  type StartMultiTradePayload,
  StartMultiTradeStrategy,
  type MultiTradeResult,
  MultiTradeStatus,
  type StartMultiTradeUser,
} from "../../roblox/roblox_trades/roblox_trades.interfaces.js";
import { MultiTradeProcessedEvent } from "../../roblox/roblox_trades/events/multi_trade_processed.event.js";
import { RobloxTradesService } from "../../roblox/roblox_trades/roblox_trades.service.js";
import { ItemTransactionEvent } from "./enums/item_transaction_event.enum.js";
import { ItemTransactionType } from "./enums/item_transaction_type.enum.js";
import { ItemTransactionStatus } from "./enums/item_transaction_status.enum.js";
import { ItemTransactionProcessedEvent } from "./events/item_transaction_processed.event.js";
import {
  DepositItemTransaction,
  ItemTransaction,
  WithdrawItemTransaction,
} from "./item_transaction.entity.js";
import { COLLECTION_NAME } from "./item_transactions.constants.js";

@Injectable()
export class ItemTransactionsService {
  private readonly logger = new Logger(ItemTransactionsService.name);

  constructor(
    @InjectCollection(COLLECTION_NAME)
    private readonly collection: Collection<ItemTransaction>,
    private readonly eventEmitter: EventEmitter2,
    private readonly cryptService: CryptService,
    private readonly robloxTradesService: RobloxTradesService
  ) {}

  async onModuleInit() {
    await this.collection.createIndex({ jobId: 1 });
  }

  prepareData(
    event: ItemTransactionEvent,
    receiver: StartMultiTradePayload["receiver"],
    senders: StartMultiTradePayload["senders"]
  ) {
    const maxItemsPerTrade = 3;
    const strategy =
      event === ItemTransactionEvent.Bot_Withdraw ||
      event === ItemTransactionEvent.Shop_Withdraw
        ? StartMultiTradeStrategy.Receiver_To_Sender
        : StartMultiTradeStrategy.Sender_To_Receiver;
    const data = {
      maxItemsPerTrade,
      strategy,
      receiver,
      senders,
    };
    const encoded = this.cryptService.encode(data);
    const encrypted = this.cryptService.encrypt(encoded);
    return encrypted;
  }

  prepareDeposit(payload: CreateDepositTransactionPayload) {
    const data = this.prepareData(payload.event, payload.receiver, [
      payload.sender,
    ]);
    const id = generateId();
    const now = new Date();
    const deposit: DepositItemTransaction = {
      _id: id,
      jobId: null,
      userId: payload.userId,
      robloUserId: payload.sender.id,
      robloReceiverId: payload.receiver.id,
      type: ItemTransactionType.Deposit,
      event: payload.event,
      status: ItemTransactionStatus.Pending,
      data,
      details: payload.details ?? null,
      createdAt: now,
      updatedAt: now,
    };
    return deposit;
  }

  prepareWithdraw(payload: CreateWithdrawTransactionPayload) {
    const data = this.prepareData(
      payload.event,
      payload.receiver,
      payload.senders
    );
    const id = generateId();
    const now = new Date();
    const withdraw: WithdrawItemTransaction = {
      _id: id,
      jobId: null,
      userId: payload.userId,
      robloUserId: payload.receiver.id,
      robloSenderIds: pickBy(payload.senders, "id"),
      type: ItemTransactionType.Withdraw,
      event: payload.event,
      status: ItemTransactionStatus.Pending,
      data,
      details: payload.details ?? null,
      createdAt: now,
      updatedAt: now,
    };
    return withdraw;
  }

  add(transaction: ItemTransaction) {
    return this.collection.insertOne(transaction);
  }

  async activate(transaction: ItemTransaction) {
    if (transaction.data === null) {
      throw new Error("No data found.");
    }
    const decrypted = this.cryptService.decrypt(transaction.data);
    const data = this.cryptService.decode(decrypted);
    const jobId = await this.robloxTradesService.startMultiTrade(data);
    if (!jobId) {
      throw new Error("Failed to add Multi-Trade.");
    }
    transaction.jobId = jobId;
    transaction.status = ItemTransactionStatus.Active;
    await this.save(transaction);
    this.logger.debug(
      `Added Multi-Trade ${jobId} for Item Transaction ${transaction._id}.`
    );
  }

  private async save(transaction: ItemTransaction) {
    transaction.updatedAt = new Date();
    await this.collection.updateOne(
      { _id: transaction._id },
      { $set: transaction }
    );
  }

  @OnEvent(MultiTradeProcessedEvent.EVENT)
  async onMultiTradeCompleted({ result }: MultiTradeProcessedEvent) {
    try {
      await this.robloxTradesService.acknowledgeMultiTrade(result.id);
      const transaction = await this.collection.findOne({
        jobId: result.id,
      });
      if (!transaction) {
        return this.logger.warn(
          `Item Transaction not found: Multi-Trade ${result.id}`
        );
      }
      this.logger.debug(
        `Item Trade ${transaction._id} ${
          result.status === MultiTradeStatus.Finished ? "finished" : "failed"
        }.`
      );
      transaction.status =
        result.status === MultiTradeStatus.Finished
          ? ItemTransactionStatus.Finished
          : ItemTransactionStatus.Failed;
      transaction.data = null;
      await this.save(transaction);
      this.eventEmitter.emit(
        ItemTransactionProcessedEvent.getName(transaction.event),
        new ItemTransactionProcessedEvent({ transaction, result })
      );
    } catch {
      this.logger.debug(`Failed to acknowledge Multi-Trade ${result.id}.`);
    }
  }
}

interface CreateItemTransactionPayload {
  userId: string;
  details?: unknown;
}

export type CreateItemTransactionUser = StartMultiTradeUser;

export interface CreateDepositTransactionPayload
  extends CreateItemTransactionPayload {
  event: DepositItemTransaction["event"];
  sender: StartMultiTradeUser;
  receiver: StartMultiTradeUser;
}

export interface CreateWithdrawTransactionPayload
  extends CreateItemTransactionPayload {
  event: WithdrawItemTransaction["event"];
  receiver: StartMultiTradeUser;
  senders: StartMultiTradeUser[];
}
