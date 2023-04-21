import {
  Logger,
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { InjectCollection } from "nestjs-super-mongodb";
import type { Collection } from "mongodb";

import { nanoid } from "../../common/nanoid.util.js";
import { CryptService } from "../../crypt/crypt.service.js";
import { SingleTradeStatus } from "../single_trade/single_trade.entity.js";
import { SingleTradeService } from "../single_trade/single_trade.service.js";
import {
  type SerializedMultiTrade,
  type MultiTrade,
  MultiTradeStatus,
  MultiTradeStep,
} from "./multi_trade.entity.js";
import type { AddMultiTradePayload } from "./multi_trade.interfaces.js";
import {
  COLLECTION_NAME,
  MULTI_TRADE_ADDED_EVENT,
} from "./multi_trade.constants.js";

@Injectable()
export class MultiTradeService {
  private readonly logger = new Logger(MultiTradeService.name);

  constructor(
    @InjectCollection(COLLECTION_NAME)
    private readonly collection: Collection<SerializedMultiTrade>,
    private readonly eventEmitter: EventEmitter2,
    private readonly cryptService: CryptService,
    private readonly singleTradeService: SingleTradeService
  ) {}

  prepare(payload: AddMultiTradePayload): MultiTrade {
    const id = nanoid(8);
    const now = new Date();
    const multiTrade: MultiTrade = {
      _id: id,
      status: MultiTradeStatus.Pending,
      step: MultiTradeStep.None,
      users: new Map(payload.users),
      userAssetIds: new Map(payload.userAssetIds),
      recyclableUserAssetIds: new Map(payload.recyclableUserAssetIds),
      children: payload.children,
      current: null,
      error: null,
      startedAt: null,
      processedAt: null,
      acknowledgedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    return multiTrade;
  }

  async add(multiTrade: MultiTrade): Promise<MultiTrade> {
    await this.collection.insertOne(this.serialize(multiTrade));
    this.eventEmitter.emit(MULTI_TRADE_ADDED_EVENT, multiTrade);
    this.logger.debug(`Added Multi-Trade ${multiTrade._id}.`);
    return multiTrade;
  }

  async save(multiTrade: MultiTrade): Promise<void> {
    multiTrade.updatedAt = new Date();
    await this.collection.updateOne(
      { _id: multiTrade._id },
      { $set: this.serialize(multiTrade) }
    );
  }

  async findById(multiTradeId: string): Promise<MultiTrade | null> {
    const multiTrade = await this.collection.findOne({ _id: multiTradeId });
    if (!multiTrade) {
      return null;
    }
    return this.deserialize(multiTrade);
  }

  async findByIdOrThrow(multiTradeId: string): Promise<MultiTrade> {
    const multiTrade = await this.findById(multiTradeId);
    if (!multiTrade) {
      throw new NotFoundException(`Multi-Trade ${multiTradeId} not found.`);
    }
    return multiTrade;
  }

  async acknowledge(multiTradeId: string): Promise<void> {
    const multiTrade = await this.findByIdOrThrow(multiTradeId);
    if (
      multiTrade.status !== MultiTradeStatus.Finished &&
      multiTrade.status !== MultiTradeStatus.Failed
    ) {
      throw new BadRequestException(
        `Multi-Trade ${multiTradeId} has not been processed.`
      );
    }
    if (multiTrade.acknowledgedAt) {
      throw new BadRequestException(
        `Multi-Trade ${multiTradeId} has already been acknowledged.`
      );
    }
    multiTrade.acknowledgedAt = new Date();
    await this.save(multiTrade);
  }

  async stats(startDate: Date, endDate: Date): Promise<Record<string, number>> {
    const [{ _id, ...stats }] = await this.collection
      .aggregate()
      .match({
        status: {
          $in: [MultiTradeStatus.Finished, MultiTradeStatus.Failed],
        },
        createdAt: { $gte: startDate, $lte: endDate },
      })
      .group({
        _id: null,
        avgTime: { $avg: { $subtract: ["$processedAt", "$startedAt"] } },
        avgJobTime: {
          $avg: {
            $divide: [
              {
                $reduce: {
                  input: "$jobs",
                  initialValue: 0,
                  in: {
                    $add: [
                      "$$value",
                      {
                        $cond: [
                          {
                            $eq: ["$$this.status", SingleTradeStatus.Finished],
                          },
                          {
                            $subtract: [
                              "$$this.processedAt",
                              "$$this.startedAt",
                            ],
                          },
                          0,
                        ],
                      },
                    ],
                  },
                },
              },
              { $size: "$jobs" },
            ],
          },
        },
        avgNumJobs: { $avg: { $size: "$jobs" } },
        finishedJobs: {
          $sum: {
            $size: {
              $filter: {
                input: "$jobs",
                as: "job",
                cond: {
                  $eq: ["$$job.status", SingleTradeStatus.Finished],
                },
              },
            },
          },
        },
        failedJobs: {
          $sum: {
            $size: {
              $filter: {
                input: "$jobs",
                as: "job",
                cond: {
                  $eq: ["$$job.status", SingleTradeStatus.Failed],
                },
              },
            },
          },
        },
      })
      .toArray();
    return stats;
  }

  async prune(date: Date): Promise<void> {
    await this.singleTradeService.prune(date);
    const { deletedCount } = await this.collection.deleteMany({
      status: { $in: [MultiTradeStatus.Finished, MultiTradeStatus.Failed] },
      processedAt: { $lte: date },
    });
    this.logger.debug(`Pruned ${deletedCount} Multi-Trade(s).`);
  }

  async destroy() {
    await this.singleTradeService.destroy();
    await this.collection.deleteMany({});
  }

  private serialize(multiTrade: MultiTrade): SerializedMultiTrade {
    return {
      ...multiTrade,
      users: multiTrade.users
        ? this.cryptService.encrypt(
            this.cryptService.encode([...multiTrade.users])
          )
        : null,
      userAssetIds: [...multiTrade.userAssetIds],
      recyclableUserAssetIds: [...multiTrade.recyclableUserAssetIds],
    };
  }

  private deserialize(multiTrade: SerializedMultiTrade): MultiTrade {
    return {
      ...multiTrade,
      users: multiTrade.users
        ? new Map(
            this.cryptService.decode(
              this.cryptService.decrypt(multiTrade.users)
            )
          )
        : null,
      userAssetIds: new Map(multiTrade.userAssetIds),
      recyclableUserAssetIds: new Map(multiTrade.recyclableUserAssetIds),
    };
  }
}
