import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleInit,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { InjectCollection } from "nestjs-super-mongodb";
import type { Collection } from "mongodb";

import { nanoid } from "../../common/nanoid.util.js";
import { CryptService } from "../../crypt/crypt.service.js";
import {
  type SingleTrade,
  SingleTradeStatus,
  SingleTradeStep,
  SingleTradeDepth,
  type SerializedSingleTrade,
  SingleTradeResult,
} from "./single_trade.entity.js";
import {
  COLLECTION_NAME,
  SINGLE_TRADE_ADDED_EVENT,
  SINGLE_TRADE_RESUMED_EVENT,
} from "./single_trade.constants.js";

@Injectable()
export class SingleTradeService implements OnModuleInit {
  private readonly logger = new Logger(SingleTradeService.name);

  constructor(
    @InjectCollection(COLLECTION_NAME)
    private readonly collection: Collection<SerializedSingleTrade>,
    private readonly eventEmitter: EventEmitter2,
    private readonly cryptService: CryptService
  ) {}

  async onModuleInit(): Promise<void> {
    await this.collection.createIndex({ status: 1 });
    await this.collection.createIndex({
      status: 1,
      processedAt: 1,
      acknowledgedAt: 1,
    });
  }

  async prepare(payload: AddSingleTradePayload): Promise<SingleTrade> {
    const id = nanoid(8);
    const now = new Date();
    const singleTrade: SingleTrade = {
      _id: id,
      parentId: payload.parentId,
      result: SingleTradeResult.None,
      status: SingleTradeStatus.Pending,
      step: SingleTradeStep.None,
      depth: SingleTradeDepth.None,
      sender: payload.sender,
      accepter: payload.accepter,
      offers: payload.offers,
      trade: null,
      error: null,
      startedAt: null,
      processedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    return singleTrade;
  }

  async add(singleTrade: SingleTrade): Promise<void> {
    await this.collection.insertOne(this.serialize(singleTrade));
    this.logger.debug(`Added Single-Trade ${singleTrade._id}.`);
    this.eventEmitter.emit(SINGLE_TRADE_ADDED_EVENT, singleTrade);
  }

  async save(singleTrade: SingleTrade): Promise<void> {
    singleTrade.updatedAt = new Date();
    await this.collection.updateOne(
      { _id: singleTrade._id },
      { $set: this.serialize(singleTrade) }
    );
  }

  async findById(singleTradeId: string): Promise<SingleTrade | null> {
    const singleTrade = await this.collection.findOne({
      _id: singleTradeId,
    });
    if (!singleTrade) {
      return null;
    }
    return this.deserialize(singleTrade);
  }

  async findPaused(): Promise<SingleTrade[]> {
    const singleTrades = await this.collection
      .find({
        status: SingleTradeStatus.Paused,
      })
      .toArray();
    return singleTrades.map((serializedSingleTrade) =>
      this.deserialize(serializedSingleTrade)
    );
  }

  async findProcessable(): Promise<SingleTrade[]> {
    const singleTrades = await this.collection
      .find({
        status: {
          $in: [
            SingleTradeStatus.Pending,
            SingleTradeStatus.Processing,
            SingleTradeStatus.Delayed,
            SingleTradeStatus.Backlogged,
          ],
        },
      })
      .toArray();
    return singleTrades.map((serializedSingleTrade) =>
      this.deserialize(serializedSingleTrade)
    );
  }

  async solveChallenge(
    singleTradeId: string,
    userId: string,
    totpCode?: string,
    totpSecret?: string
  ): Promise<void> {
    if (!totpCode && !totpSecret) {
      throw new BadRequestException("No TOTP code or secret provided.");
    }
    const realUserId = parseInt(userId, 10);
    if (isNaN(realUserId)) {
      throw new BadRequestException("Invalid user ID.");
    }
    const singleTrade = await this.findById(singleTradeId);
    if (!singleTrade) {
      throw new NotFoundException(`Single-Trade ${singleTradeId} not found.`);
    }
    if (singleTrade.status !== SingleTradeStatus.Paused) {
      throw new ConflictException(
        `Single-Trade ${singleTradeId} is not paused.`
      );
    }
    const user =
      singleTrade.depth === SingleTradeDepth.Send_Trade
        ? singleTrade.sender
        : singleTrade.accepter;
    if (!user) {
      throw new BadRequestException(
        `Single-Trade ${singleTradeId} is in an invalid state.`
      );
    }
    if (user.id !== realUserId) {
      throw new BadRequestException(
        `User ${userId} is not relevant to the current state of Single-Trade ${singleTradeId}.`
      );
    }
    if (!user.totp) {
      user.totp = {};
    }
    if (totpCode) {
      user.totp.code = totpCode;
    }
    if (totpSecret) {
      user.totp.secret = totpSecret;
    }
    singleTrade.status = SingleTradeStatus.Processing;
    await this.save(singleTrade);
    this.logger.debug(`Resumed Single-Trade ${singleTradeId}.`);
    this.eventEmitter.emit(SINGLE_TRADE_RESUMED_EVENT, singleTrade);
  }

  async prune(date: Date): Promise<void> {
    const { deletedCount } = await this.collection.deleteMany({
      status: SingleTradeStatus.Processed,
      processedAt: { $lt: date },
      acknowledgedAt: { $ne: null },
    });
    this.logger.debug(`Pruned ${deletedCount} Single-Trade(s).`);
  }

  async clear(): Promise<void> {
    await this.collection.deleteMany({});
  }

  private serialize(singleTrade: SingleTrade): SerializedSingleTrade {
    return {
      ...singleTrade,
      sender: singleTrade.sender
        ? this.cryptService.encrypt(
            this.cryptService.encode(singleTrade.sender)
          )
        : null,
      accepter: singleTrade.accepter
        ? this.cryptService.encrypt(
            this.cryptService.encode(singleTrade.accepter)
          )
        : null,
    };
  }

  private deserialize(singleTrade: SerializedSingleTrade): SingleTrade {
    return {
      ...singleTrade,
      sender: singleTrade.sender
        ? this.cryptService.decode(
            this.cryptService.decrypt(singleTrade.sender)
          )
        : null,
      accepter: singleTrade.accepter
        ? this.cryptService.decode(
            this.cryptService.decrypt(singleTrade.accepter)
          )
        : null,
    };
  }
}

type AddSingleTradePayload = Pick<
  SingleTrade,
  "parentId" | "sender" | "accepter" | "offers"
>;
