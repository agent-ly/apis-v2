import { Injectable, Logger } from "@nestjs/common";
import { InjectCollection } from "nestjs-super-mongodb";
import type { Collection } from "mongodb";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import { nanoid } from "nanoid";

import {
  type SingleTrade,
  SingleTradeStatus,
  SingleTradeStep,
  SingleTradeDepth,
} from "./single_trade.entity.js";
import type {
  AddSingleTradePayload,
  SingleTradeJobData,
} from "./single_trade.interfaces.js";
import { COLLECTION_NAME, QUEUE_NAME } from "./single_trade.constants.js";

@Injectable()
export class SingleTradeService {
  private readonly logger = new Logger(SingleTradeService.name);

  constructor(
    @InjectCollection(COLLECTION_NAME)
    private readonly collection: Collection<SingleTrade>,
    @InjectQueue(QUEUE_NAME)
    private readonly queue: Queue<SingleTradeJobData>
  ) {}

  findById(singleTradeId: string): Promise<SingleTrade | null> {
    return this.collection.findOne({ _id: singleTradeId });
  }

  async add(payload: AddSingleTradePayload): Promise<SingleTrade> {
    const id = nanoid(8);
    const now = new Date();
    const singleTrade: SingleTrade = {
      _id: id,
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
    await this.collection.insertOne(singleTrade);
    await this.queue.add(
      "process",
      { singleTradeId: id },
      { jobId: `stid_${id}` }
    );
    this.logger.debug(`Added Single-Trade ${id}.`);
    return singleTrade;
  }

  async save(singleTrade: SingleTrade): Promise<void> {
    singleTrade.updatedAt = new Date();
    await this.collection.updateOne(
      { _id: singleTrade._id },
      { $set: singleTrade }
    );
  }

  async prune(date: Date): Promise<void> {
    const { deletedCount } = await this.collection.deleteMany({
      status: { $in: [SingleTradeStatus.Finished, SingleTradeStatus.Failed] },
      processedAt: { $lt: date },
    });
    this.logger.debug(`Pruned ${deletedCount} Single-Trade(s).`);
  }

  async drainQueue(): Promise<void> {
    await this.queue.drain();
  }

  async pauseQueue(): Promise<void> {
    await this.queue.pause();
  }

  async destroy(): Promise<void> {
    await this.queue.obliterate({ force: true });
    await this.collection.deleteMany({});
  }
}
