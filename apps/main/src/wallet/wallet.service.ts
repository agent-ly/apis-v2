import {
  BadRequestException,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from "@nestjs/common";
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter";
import { InjectCollection } from "nestjs-super-mongodb";
import type { Collection, Filter, UpdateFilter } from "mongodb";
import {
  DocumentLockAcquisitionError,
  withDocumentLock,
} from "mongodb-super-util/document_lock";
import { nanoid } from "nanoid";

import type { User } from "../users/user.entity.js";
import { USER_CREATED_EVENT } from "../users/users.constants.js";
import { TransactionEvent } from "./transactions/enums/transaction_event.enum.js";
import { TransactionType } from "./transactions/enums/transaction_type.enum.js";
import { TransactionsService } from "./transactions/transactions.service.js";
import { AmountZeroError } from "./errors/amount_zero.error.js";
import { AmountInvalidError } from "./errors/amount_invalid.error.js";
import { BalanceInsufficientError } from "./errors/balance_insufficient.error.js";
import { BalanceLockedError } from "./errors/balance_locked.error.js";
import { AmlError } from "./errors/aml.error.js";
import { KycError } from "./errors/kyc.error.js";
import { WithdrawPayloadDto } from "./dto/withdraw_payload.dto.js";
import { WalletBalanceModifiedEvent } from "./events/wallet_balance_modified.event.js";
import { Wallet } from "./wallet.entity.js";
import { COLLECTION_NAME } from "./wallet.constants.js";

@Injectable()
export class WalletService implements OnModuleInit {
  constructor(
    @InjectCollection(COLLECTION_NAME)
    private readonly collection: Collection<Wallet>,
    private readonly transactionsService: TransactionsService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  async onModuleInit() {
    await this.collection.createIndexes([
      { key: { userId: 1 }, unique: true },
      { key: { userId: 1, balance: 1 } },
      { key: { userId: 1, enabled: 1, balance: 1 } },
    ]);
  }

  async insert(userId: string) {
    const id = nanoid();
    const now = new Date();
    const wallet: Wallet = {
      _id: id,
      userId,
      enabled: true,
      verified: false,
      balance: 0,
      deposited: 0,
      withdrawn: 0,
      wagered: 0,
      won: 0,
      sold: 0,
      bought: 0,
      lockedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await this.collection.insertOne(wallet);
    return id;
  }

  findById(userId: string) {
    return this.collection.findOne({ userId });
  }

  async findByIdOrThrow(userId: string) {
    const wallet = await this.collection.findOne({ userId });
    if (!wallet) {
      throw new NotFoundException("Wallet not found.");
    }
    return wallet;
  }

  async withdraw(userId: string, payload: WithdrawPayloadDto) {
    await this.subtractBalance({
      userId,
      amount: payload.amount,
      event: TransactionEvent.Wallet_Withdraw,
      details: { address: payload.address },
    });
  }

  async addBalance(payload: ModifyBalancePayload) {
    AmountZeroError.assert(payload.amount);
    AmountInvalidError.assertPositive(payload.amount);
    const filter: Filter<Wallet> = { userId: payload.userId };
    const update: UpdateFilter<Wallet> = {};
    update.$inc = { amount: payload.amount };
    update.$currentDate = { updatedAt: true };
    switch (payload.event) {
      case TransactionEvent.Wallet_Deposit:
        update.$inc = {
          ...update.$inc,
          deposited: payload.amount,
        };
        break;

      case TransactionEvent.Wager_Cancel:
      case TransactionEvent.Wager_Won:
        update.$inc = {
          ...update.$inc,
          [payload.event === TransactionEvent.Wager_Won ? "won" : "wagered"]:
            TransactionEvent.Wager_Won ? payload.amount : -payload.amount,
        };
        break;

      case TransactionEvent.Shop_Sold:
      case TransactionEvent.Shop_Refund:
        update.$inc = {
          ...update.$inc,
          sold:
            payload.event === TransactionEvent.Shop_Sold
              ? payload.amount
              : -payload.amount,
        };
        break;
    }
    return this.modifyBalance(filter, update, TransactionType.Deposit, payload);
  }

  async subtractBalance(payload: ModifyBalancePayload) {
    AmountZeroError.assert(payload.amount);
    AmountInvalidError.assertNegative(payload.amount);
    const wallet = await this.findByIdOrThrow(payload.userId);
    BalanceLockedError.assert(wallet.enabled);
    BalanceInsufficientError.assert(payload.amount, wallet.balance);
    const filter: Filter<Wallet> = {
      userId: payload.userId,
      enabled: true,
      balance: { $gte: -payload.amount },
    };
    if (payload.event === TransactionEvent.Wallet_Withdraw) {
      AmlError.assert(wallet.wagered, wallet.deposited);
      KycError.assert(wallet.verified, wallet.withdrawn);
    }
    const update: UpdateFilter<Wallet> = {
      $inc: { amount: payload.amount },
      $currentDate: { updatedAt: true },
    };
    switch (payload.event) {
      case TransactionEvent.Wallet_Withdraw:
        update.$inc = { ...update.$inc, withdrawn: payload.amount };
        break;

      case TransactionEvent.Wager_Create:
        update.$inc = { ...update.$inc, wagered: payload.amount };
        break;

      case TransactionEvent.Shop_Buy:
        update.$inc = { ...update.$inc, bought: payload.amount };
        break;
    }
    try {
      return await withDocumentLock(this.collection, wallet, () =>
        this.modifyBalance(filter, update, TransactionType.Withdraw, payload)
      );
    } catch (error) {
      if (error instanceof DocumentLockAcquisitionError) {
        throw new BadRequestException("Another transaction is in progress.");
      }
      throw error;
    }
  }

  async modifyBalance(
    filter: Filter<Wallet>,
    update: UpdateFilter<Wallet>,
    type: TransactionType,
    payload: ModifyBalancePayload
  ) {
    const result = await this.collection.findOneAndUpdate(filter, update);
    if (!result.value) {
      throw new NotFoundException("Wallet not found.");
    }
    const transactionId = await this.transactionsService.create({
      userId: payload.userId,
      type,
      event: payload.event,
      amount: payload.amount,
      previousBalance: result.value.balance,
      newBalance: result.value.balance + payload.amount,
      details: payload.details ?? null,
    });
    this.eventEmitter.emit(
      WalletBalanceModifiedEvent.EVENT,
      new WalletBalanceModifiedEvent(payload.userId, payload.amount)
    );
    return transactionId;
  }

  @OnEvent(USER_CREATED_EVENT)
  async onUserCreated(user: User) {
    await this.insert(user._id);
  }
}

interface ModifyBalancePayload {
  userId: string;
  event: TransactionEvent;
  amount: number;
  details?: unknown;
}
