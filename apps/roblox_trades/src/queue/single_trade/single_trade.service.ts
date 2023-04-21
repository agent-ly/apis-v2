import { Injectable, Logger } from "@nestjs/common";
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
} from "./single_trade.entity.js";
import type { AddSingleTradePayload } from "./single_trade.interfaces.js";
import {
  COLLECTION_NAME,
  SINGLE_TRADE_ADDED_EVENT,
} from "./single_trade.constants.js";

@Injectable()
export class SingleTradeService {
  private readonly logger = new Logger(SingleTradeService.name);

  constructor(
    @InjectCollection(COLLECTION_NAME)
    private readonly collection: Collection<SerializedSingleTrade>,
    private readonly eventEmitter: EventEmitter2,
    private readonly cryptService: CryptService
  ) {}

  async prepare(payload: AddSingleTradePayload): Promise<SingleTrade> {
    const id = nanoid(8);
    const now = new Date();
    const singleTrade: SingleTrade = {
      _id: id,
      parentId: payload.parentId,
      status: SingleTradeStatus.Pending,
      step: SingleTradeStep.None,
      depth: SingleTradeDepth.None,
      sender: payload.sender,
      accepter: payload.accepter,
      offers: payload.offers,
      trade: null,
      error: null,
      runAt: now,
      startedAt: null,
      processedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    return singleTrade;
  }

  async add(singleTrade: SingleTrade): Promise<void> {
    await this.collection.insertOne(this.serialize(singleTrade));
    this.eventEmitter.emit(SINGLE_TRADE_ADDED_EVENT, singleTrade);
    this.logger.debug(`Added Single-Trade ${singleTrade._id}.`);
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
        runAt: { $lte: new Date() },
      })
      .toArray();
    return singleTrades.map((serializedSingleTrade) =>
      this.deserialize(serializedSingleTrade)
    );
  }

  async prune(date: Date): Promise<void> {
    const { deletedCount } = await this.collection.deleteMany({
      status: { $in: [SingleTradeStatus.Finished, SingleTradeStatus.Failed] },
      processedAt: { $lt: date },
    });
    this.logger.debug(`Pruned ${deletedCount} Single-Trade(s).`);
  }

  async destroy(): Promise<void> {
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
