import { Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { DelayedError, type Job } from "bullmq";

import {
  SingleTrade,
  SingleTradeOffer,
  SingleTradeStatus,
} from "../single_trade/single_trade.entity.js";
import { SingleTradeService } from "../single_trade/single_trade.service.js";
import {
  type MultiTrade,
  MultiTradeStep,
  MultiTradeJob,
  MultiTradeJobStrategy,
  MultiTradeStatus,
} from "./multi_trade.entity.js";
import type { MultiTradeJobData } from "./multi_trade.interfaces.js";
import {
  MULTI_TRADE_PROCESSED_EVENT,
  QUEUE_NAME,
} from "./multi_trade.constants.js";
import { MultiTradeService } from "./multi_trade.service.js";

@Processor(QUEUE_NAME)
export class MultiTradeWorker extends WorkerHost {
  private static readonly START_TRADE_DELAY = 1e3 * 7.5; // 7.5 seconds
  private static readonly WAIT_TRADE_DELAY = 1e3 * 7.5; // 7.5 seconds
  private static readonly DELAYED_TRADE_TIMEOUT = 1e3 * 60; // 1 minute(s)
  private static readonly BACKLOGGED_TRADE_TIMEOUT = 1e3 * 60 * 25; // 25 minute(s)

  private readonly logger = new Logger(MultiTradeWorker.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly singleTradeService: SingleTradeService,
    private readonly multiTradeService: MultiTradeService
  ) {
    super();
  }

  async process(job: Job<MultiTradeJobData>): Promise<void> {
    this.logger.debug(`Processing job ${job.id}...`);
    const multiTrade = await this.multiTradeService.findById(
      job.data.multiTradeId
    );
    if (!multiTrade) {
      return this.logger.error(
        `Multi-Trade not found: ${job.data.multiTradeId}`
      );
    }
    try {
      if (multiTrade.step === MultiTradeStep.None) {
        multiTrade.status = MultiTradeStatus.Processing;
        multiTrade.step = MultiTradeStep.Start_Trade;
        multiTrade.currentJobIndex = 0;
        await this.multiTradeService.save(multiTrade);
        this.logger.debug(`Initialized Multi-Trade ${multiTrade._id}.`);
      }
      if (multiTrade.step === MultiTradeStep.Start_Trade) {
        await this.handleStartTrade(job, multiTrade);
      } else if (multiTrade.step === MultiTradeStep.Wait_Trade) {
        await this.handleWaitTrade(job, multiTrade);
      }
    } catch (error) {
      if (error instanceof DelayedError) {
        throw error;
      }
      this.logger.error(
        `Error processing job ${job.id}: ${(error as Error).message}`
      );
    }
  }

  private async handleStartTrade(
    job: Job<MultiTradeJobData>,
    multiTrade: MultiTrade
  ): Promise<void> {
    const currentJob = multiTrade.jobs[multiTrade.currentJobIndex!];
    if (!currentJob) {
      return this.handleFailed(
        multiTrade,
        `Job #${multiTrade.currentJobIndex} not found.`
      );
    }
    try {
      await this.enqueueSingleTrade(currentJob, multiTrade);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return this.handleFailed(multiTrade, message);
    }
    const timestamp = Date.now() + MultiTradeWorker.START_TRADE_DELAY;
    await job.moveToDelayed(timestamp, job.token);
    throw new DelayedError();
  }

  private async handleWaitTrade(
    job: Job<MultiTradeJobData>,
    multiTrade: MultiTrade
  ): Promise<void> {
    this.logger.debug(
      `Checking job #${multiTrade.currentJobIndex} of Multi-Trade ${multiTrade._id}...`
    );

    const currentJob = multiTrade.jobs[multiTrade.currentJobIndex!];
    const singleTrade = await this.singleTradeService.findById(
      currentJob.refId!
    );
    if (!singleTrade) {
      return this.handleFailed(
        multiTrade,
        `Single-Trade ${currentJob.refId} not found.`
      );
    }

    currentJob.refStatus = singleTrade.status;
    if (singleTrade.trade) {
      currentJob.tradeId = singleTrade.trade.id;
      currentJob.tradeStatus = singleTrade.trade.status;
    }
    currentJob.startedAt = singleTrade.startedAt;
    currentJob.processedAt = singleTrade.processedAt;
    if (singleTrade.status === SingleTradeStatus.Failed) {
      multiTrade.status = MultiTradeStatus.Failed;
      multiTrade.step = MultiTradeStep.None;
      multiTrade.error = singleTrade.error;
      this.logger.error(
        `Job #${multiTrade.currentJobIndex} of Multi-Trade ${multiTrade._id} failed.`
      );
    } else if (singleTrade.status === SingleTradeStatus.Finished) {
      this.reconcileOffers(multiTrade, singleTrade);
      const isLastJob =
        multiTrade.currentJobIndex === multiTrade.jobs.length - 1;
      multiTrade.status = isLastJob
        ? MultiTradeStatus.Finished
        : MultiTradeStatus.Processing;
      multiTrade.step = isLastJob
        ? MultiTradeStep.None
        : MultiTradeStep.Start_Trade;
      multiTrade.currentJobIndex = isLastJob
        ? null
        : multiTrade.currentJobIndex! + 1;
      this.logger.debug(
        `Job #${multiTrade.currentJobIndex} of Multi-Trade ${multiTrade._id} finished.`
      );
      if (isLastJob) {
        this.logger.debug(`Multi-Trade ${multiTrade._id} finished`);
      }
    }
    if (multiTrade.step === MultiTradeStep.None) {
      return this.handleProcessed(currentJob, multiTrade);
    }

    let timestamp = 0;
    if (multiTrade.step === MultiTradeStep.Wait_Trade) {
      let delay =
        singleTrade.status === SingleTradeStatus.Backlogged
          ? MultiTradeWorker.BACKLOGGED_TRADE_TIMEOUT
          : singleTrade.status === SingleTradeStatus.Delayed
          ? MultiTradeWorker.DELAYED_TRADE_TIMEOUT
          : MultiTradeWorker.WAIT_TRADE_DELAY;
      timestamp = Date.now() + delay;
    }
    await this.multiTradeService.save(multiTrade);
    await job.moveToDelayed(timestamp, job.token);
    throw new DelayedError();
  }

  private async handleProcessed(
    lastJob: MultiTradeJob,
    multiTrade: MultiTrade
  ): Promise<void> {
    this.handleRedactCredentials(multiTrade);
    multiTrade.processedAt = lastJob.processedAt;
    await this.multiTradeService.save(multiTrade);
    this.logger.debug(`Multi-Trade ${multiTrade._id} processed.`);
    this.eventEmitter.emit(MULTI_TRADE_PROCESSED_EVENT, multiTrade);
  }

  private async handleFailed(
    multiTrade: MultiTrade,
    message: string
  ): Promise<void> {
    multiTrade.status = MultiTradeStatus.Failed;
    this.handleRedactCredentials(multiTrade);
    multiTrade.error = {
      statusCode: 500,
      errorCode: -1,
      message,
    };
    multiTrade.processedAt = new Date();
    await this.multiTradeService.save(multiTrade);
    this.logger.error(`Multi-Trade ${multiTrade._id} failed: ${message}`);
    this.eventEmitter.emit(MULTI_TRADE_PROCESSED_EVENT, multiTrade);
  }

  private handleRedactCredentials(multiTrade: MultiTrade): MultiTrade {
    multiTrade.credentials = null;
    return multiTrade;
  }

  private async enqueueSingleTrade(
    multiTradeJob: MultiTradeJob,
    multiTrade: MultiTrade
  ): Promise<void> {
    // Resolve the offerTo and offerFrom recyclables
    const offerToRecyclables = multiTrade.recyclableUserAssetIds.get(
      multiTradeJob.offerToUserId
    );
    const offerToRecyclable = offerToRecyclables
      ? offerToRecyclables[0]
      : undefined;
    if (offerToRecyclable === undefined) {
      throw new Error(
        `No recyclable to offer from User ${multiTradeJob.offerToUserId}.`
      );
    }
    const offerFromRecyclables = multiTrade.recyclableUserAssetIds.get(
      multiTradeJob.offerFromUserId
    );
    const offerFromRecyclable = offerFromRecyclables
      ? offerFromRecyclables[0]
      : undefined;

    // Determine the sender and accepter
    if (!multiTrade.credentials) {
      throw new Error("Credentials redacted.");
    }
    const senderId =
      multiTradeJob.strategy === MultiTradeJobStrategy.Sender_To_Receiver
        ? multiTradeJob.offerFromUserId
        : multiTradeJob.offerToUserId;
    const accepterId =
      multiTradeJob.strategy === MultiTradeJobStrategy.Sender_To_Receiver
        ? multiTradeJob.offerToUserId
        : multiTradeJob.offerFromUserId;
    const senderCredentials = multiTrade.credentials.get(senderId);
    if (!senderCredentials) {
      throw new Error(`Credentials for User ${senderId} not found.`);
    }
    const acccepterCredentials = multiTrade.credentials.get(accepterId);
    if (!acccepterCredentials) {
      throw new Error(`Credentials for User ${accepterId} not found.`);
    }
    const sender = { id: senderId, credentials: senderCredentials };
    const accepter = { id: accepterId, credentials: acccepterCredentials };

    // Enqueue the single-trade
    const offer = {
      userId: multiTradeJob.offerFromUserId,
      userAssetIds: multiTradeJob.userAssetIds,
      recyclableUserAssetId: offerFromRecyclable,
    };
    const receive = {
      userId: multiTradeJob.offerToUserId,
      recyclableUserAssetId: offerToRecyclable,
    };
    const singleTrade = await this.singleTradeService.add({
      sender,
      accepter,
      offers: [offer, receive],
    });

    // Update the multi-trade
    multiTradeJob.refId = singleTrade._id;
    multiTradeJob.refStatus = singleTrade.status;
    multiTradeJob.startedAt = new Date();
    multiTrade.step = MultiTradeStep.Wait_Trade;
    await this.multiTradeService.save(multiTrade);
    this.logger.debug(
      `Job #${multiTrade.currentJobIndex} of Multi-Trade ${multiTrade._id} started.`
    );
  }

  private reconcileOffers(
    multiTrade: MultiTrade,
    singleTrade: SingleTrade
  ): void {
    const [offer, receive] = singleTrade.offers;
    this.reconileUserAssets(multiTrade, offer, receive);
    this.reconcileRecyclables(multiTrade, offer, receive);
  }

  private reconileUserAssets(
    multiTrade: MultiTrade,
    offer: SingleTradeOffer,
    receive: SingleTradeOffer
  ): void {
    modifyMapArray(multiTrade.userAssetIds, {
      key: offer.userId,
      remove: offer.userAssetIds,
      add: receive.userAssetIds,
    });
    modifyMapArray(multiTrade.userAssetIds, {
      key: receive.userId,
      remove: receive.userAssetIds,
      add: offer.userAssetIds,
    });
  }

  private reconcileRecyclables(
    multiTrade: MultiTrade,
    offer: SingleTradeOffer,
    receive: SingleTradeOffer
  ): void {
    modifyMapArray(multiTrade.recyclableUserAssetIds, {
      key: offer.userId,
      remove: [offer.recyclableUserAssetId],
      add: [receive.recyclableUserAssetId],
    });
    modifyMapArray(multiTrade.recyclableUserAssetIds, {
      key: receive.userId,
      remove: [receive.recyclableUserAssetId],
      add: [offer.recyclableUserAssetId],
    });
  }
}

interface ModifyMapArrayOptions<TKey, TValue> {
  key: TKey;
  remove?: TValue[] | null;
  add?: TValue[] | null;
}

const modifyMapArray = <TKey, TValue>(
  map: Map<TKey, TValue[]>,
  { key, remove, add }: ModifyMapArrayOptions<TKey, TValue>
): void => {
  let current = map.get(key) || [];
  if (remove && remove.length > 0) {
    // Technically since everything occurs in order, we could splice here.
    // However, this is more robust in case we ever change the order of operations.
    current = current.filter((id) => !remove.includes(id));
  }
  if (add && add.length > 0) {
    current.push(...add);
  }
  map.set(key, current);
};
