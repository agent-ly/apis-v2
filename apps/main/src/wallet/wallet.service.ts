import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter";
import { InjectCollection } from "nestjs-super-mongodb";
import type { Collection, Filter, UpdateFilter } from "mongodb";
import {
  DocumentLockAcquisitionError,
  withDocumentLock,
} from "mongodb-super-util/document_lock";

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
export class WalletService {
  constructor(
    @InjectCollection(COLLECTION_NAME)
    private readonly collection: Collection<Wallet>,
    private readonly transactionsService: TransactionsService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  async create(userId: string): Promise<void> {
    const now = new Date();
    const wallet: Wallet = {
      _id: userId,
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
  }

  findById(walletId: string): Promise<Wallet | null> {
    return this.collection.findOne({ _id: walletId });
  }

  async findByIdOrThrow(walletId: string): Promise<Wallet> {
    const wallet = await this.collection.findOne({ _id: walletId });
    if (!wallet) {
      throw new NotFoundException("Wallet not found.");
    }
    return wallet;
  }

  async withdraw(userId: string, payload: WithdrawPayloadDto): Promise<void> {
    await this.subtractBalance({
      userId,
      event: TransactionEvent.Wallet_Withdraw,
      amount: payload.amount,
      details: { address: payload.address },
    });
    // Withdraw from bitcoin wallet
  }

  async hasBalance(userId: string, amount: number): Promise<boolean> {
    const wallet = await this.findByIdOrThrow(userId);
    if (amount > wallet.balance) {
      throw new BalanceInsufficientError();
    }
    return true;
  }

  addBalance(payload: ModifyBalancePayload): Promise<string> {
    AmountZeroError.assert(payload.amount);
    AmountInvalidError.assertPositive(payload.amount);
    return this.modifyBalance({
      type: TransactionType.Deposit,
      ...payload,
    });
  }

  async subtractBalance(payload: ModifyBalancePayload): Promise<string> {
    AmountZeroError.assert(payload.amount);
    AmountInvalidError.assertNegative(payload.amount);
    const wallet = await this.findByIdOrThrow(payload.userId);
    BalanceLockedError.assert(wallet.enabled);
    BalanceInsufficientError.assert(payload.amount, wallet.balance);
    if (payload.event === TransactionEvent.Wallet_Withdraw) {
      AmlError.assert(wallet.wagered, wallet.deposited);
      KycError.assert(wallet.verified, wallet.withdrawn);
    }
    try {
      const transactionId = await withDocumentLock(
        this.collection,
        wallet,
        () =>
          this.modifyBalance({
            type: TransactionType.Withdraw,
            ...payload,
          })
      );
      return transactionId;
    } catch (error) {
      if (error instanceof DocumentLockAcquisitionError) {
        throw new BadRequestException({
          message: "Another transaction is in progress.",
        });
      }
      throw error;
    }
  }

  async modifyBalance(payload: InternalModifyBalancePayload): Promise<string> {
    const filter: Filter<Wallet> = { _id: payload.userId };
    const update: UpdateFilter<Wallet> = {
      $inc: { balance: payload.amount },
      $currentDate: { updatedAt: true },
    };
    const result = await this.collection.findOneAndUpdate(filter, update);
    if (!result.value) {
      throw new NotFoundException("Wallet not found.");
    }
    if (payload.type === TransactionType.Withdraw) {
      // ? We could use Math.abs() here, but there should never be a case where the amount is positive.
      const inverseAmount = -payload.amount;
      let error = !result.value.enabled
        ? new BalanceLockedError()
        : result.value.balance < inverseAmount
        ? new BalanceInsufficientError()
        : null;
      if (error) {
        const reversion: UpdateFilter<Wallet> = {
          $inc: { balance: inverseAmount },
          $currentDate: { updatedAt: true },
        };
        await this.collection.updateOne(filter, reversion);
        throw error;
      }
    }
    const transactionId = await this.transactionsService.create({
      userId: payload.userId,
      type: payload.type,
      event: payload.event,
      amount: payload.amount,
      previousBalance: result.value.balance,
      newBalance: result.value.balance + payload.amount,
      details: payload.details ?? null,
    });
    this.eventEmitter.emit(
      WalletBalanceModifiedEvent.EVENT,
      new WalletBalanceModifiedEvent({
        userId: payload.userId,
        event: payload.event,
        amount: payload.amount,
      })
    );
    return transactionId;
  }

  @OnEvent(WalletBalanceModifiedEvent.EVENT)
  async onUserBalanceModified({
    userId,
    event,
    amount,
  }: WalletBalanceModifiedEvent): Promise<void> {
    const filter: Filter<Wallet> = { userId };
    const update: UpdateFilter<Wallet> = {};
    switch (event) {
      case TransactionEvent.Wallet_Withdraw:
        update.$inc = { ...update.$inc, withdrawn: amount };
        break;
      case TransactionEvent.Wallet_Deposit:
        update.$inc = {
          ...update.$inc,
          deposited: amount,
        };
        break;

      case TransactionEvent.Wager_Create:
        update.$inc = { ...update.$inc, wagered: amount };
        break;
      case TransactionEvent.Wager_Cancel:
      case TransactionEvent.Wager_Won:
        update.$inc = {
          ...update.$inc,
          [event === TransactionEvent.Wager_Won ? "won" : "wagered"]:
            TransactionEvent.Wager_Won ? amount : -amount,
        };
        break;

      case TransactionEvent.Shop_Buy:
        update.$inc = { ...update.$inc, bought: amount };
        break;
      case TransactionEvent.Shop_Sold:
      case TransactionEvent.Shop_Refund:
        update.$inc = {
          ...update.$inc,
          sold: event === TransactionEvent.Shop_Sold ? amount : -amount,
        };
        break;
    }
    await this.collection.updateOne(filter, update);
  }

  @OnEvent(USER_CREATED_EVENT)
  async onUserCreated(user: User): Promise<void> {
    await this.create(user._id);
  }
}

interface ModifyBalancePayload {
  userId: string;
  event: TransactionEvent;
  amount: number;
  details?: unknown;
}

interface InternalModifyBalancePayload extends ModifyBalancePayload {
  type: TransactionType;
}
