import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter";
import { InjectCollection } from "nestjs-super-mongodb";
import type { Collection } from "mongodb";
import { nanoid } from "nanoid";

import { CryptService } from "../../crypt/crypt.service.js";
import {
  type AddMultiTradePayload,
  AddMultiTradeStrategy,
  type MultiTradeResult,
  MultiTradeStatus,
} from "../../roblox/roblox.interfaces.js";
import { MULTI_TRADE_PROCESSED_EVENT } from "../../roblox/roblox.constants.js";
import { RobloxService } from "../../roblox/roblox.service.js";
import { ItemTransactionEvent } from "./enums/item_transaction_event.enum.js";
import { ItemTransactionType } from "./enums/item_transaction_type.enum.js";
import { ItemTransactionStatus } from "./enums/item_transaction_status.enum.js";
import { ItemTransactionProcessedEvent } from "./events/item_transaction_processed.event.js";
import { ItemTransaction } from "./item_transaction.entity.js";
import {
  COLLECTION_NAME,
  ITEM_TRANSACTION_PROCESSED_EVENT,
} from "./item_transactions.constants.js";

@Injectable()
export class ItemTransactionsService {
  private readonly logger = new Logger(ItemTransactionsService.name);

  constructor(
    @InjectCollection(COLLECTION_NAME)
    private readonly collection: Collection<ItemTransaction>,
    private readonly eventEmitter: EventEmitter2,
    private readonly cryptService: CryptService,
    private readonly robloxService: RobloxService
  ) {}

  async onModuleInit() {
    await this.collection.createIndex({ jobId: 1 });
  }

  create(payload: CreateItemTransactionPayload) {
    const strategy =
      payload.event === ItemTransactionEvent.Bot_Withdraw ||
      payload.event === ItemTransactionEvent.Shop_Withdraw
        ? AddMultiTradeStrategy.Receiver_To_Sender
        : AddMultiTradeStrategy.Sender_To_Receiver;
    // TODO: Calculate based on # of smalls
    const maxItemsPerTrade = 3;
    const data = {
      maxItemsPerTrade,
      strategy,
      sender: payload.sender,
      receiver: payload.receiver,
    };
    const encoded = this.cryptService.encode(data);
    const encrypted = this.cryptService.encrypt(encoded);
    const id = nanoid();
    const now = new Date();
    const itemTransaction: ItemTransaction = {
      _id: id,
      jobId: null,
      userId: payload.userId,
      senderId: payload.sender.id,
      receiverId: payload.receiver.id,
      type: payload.type,
      event: payload.event,
      status: ItemTransactionStatus.Pending,
      data: encrypted,
      details: payload.details ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.logger.debug(`Created Item Transaction ${id}.`);
    return itemTransaction;
  }

  add(itemTransaction: ItemTransaction) {
    return this.collection.insertOne(itemTransaction);
  }

  async activate(itemTransaction: ItemTransaction) {
    if (itemTransaction.data === null) {
      throw new Error("No data found.");
    }
    const decrypted = this.cryptService.decrypt(itemTransaction.data);
    const data = this.cryptService.decode<AddMultiTradePayload>(decrypted);
    const jobId = await this.robloxService.addMultiTrade(data);
    if (!jobId) {
      throw new Error("Failed to add Multi-Trade.");
    }
    itemTransaction.jobId = jobId;
    itemTransaction.status = ItemTransactionStatus.Active;
    await this.save(itemTransaction);
    this.logger.debug(
      `Added Multi-Trade ${jobId} for Item Transaction ${itemTransaction._id}.`
    );
  }

  private async save(itemTransaction: ItemTransaction) {
    itemTransaction.updatedAt = new Date();
    await this.collection.updateOne(
      { _id: itemTransaction._id },
      { $set: itemTransaction }
    );
  }

  @OnEvent(MULTI_TRADE_PROCESSED_EVENT)
  async onMultiTradeCompleted(multiTradeResult: MultiTradeResult) {
    try {
      await this.robloxService.acknowledgeMultiTrade(multiTradeResult.id);
      const itemTransaction = await this.collection.findOne({
        jobId: multiTradeResult.id,
      });
      if (!itemTransaction) {
        return this.logger.warn(
          `Item Transaction not found: Multi-Trade ${multiTradeResult.id}`
        );
      }
      this.logger.debug(
        `Item Trade ${itemTransaction._id} ${
          multiTradeResult.status === MultiTradeStatus.Finished
            ? "finished"
            : "failed"
        }.`
      );
      itemTransaction.status =
        multiTradeResult.status === MultiTradeStatus.Finished
          ? ItemTransactionStatus.Finished
          : ItemTransactionStatus.Failed;
      await this.save(itemTransaction);
      const event = `${ITEM_TRANSACTION_PROCESSED_EVENT}.${itemTransaction.event}`;
      this.eventEmitter.emit(
        event,
        new ItemTransactionProcessedEvent(itemTransaction, multiTradeResult)
      );
    } catch {
      this.logger.debug(
        `Failed to acknowledge Multi-Trade ${multiTradeResult.id}.`
      );
    }
  }
}

export interface CreateItemTransactionPayload {
  userId: string;
  type: ItemTransactionType;
  event: ItemTransactionEvent;
  sender: AddMultiTradePayload["sender"];
  receiver: AddMultiTradePayload["receiver"];
  details?: unknown;
}
