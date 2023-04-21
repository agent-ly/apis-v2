import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";

import {
  type SingleTrade,
  type SingleTradeOffer,
  SingleTradeStatus,
  type SingleTradeUser,
} from "../single_trade/single_trade.entity.js";
import { SingleTradeService } from "../single_trade/single_trade.service.js";
import {
  type MultiTrade,
  MultiTradeStep,
  MultiTradeChild,
  MultiTradeChildStrategy,
  MultiTradeStatus,
  MultiTradeUser,
} from "./multi_trade.entity.js";
import { MULTI_TRADE_PROCESSED_EVENT } from "./multi_trade.constants.js";
import { MultiTradeService } from "./multi_trade.service.js";

@Injectable()
export class MultiTradeWorker {
  private readonly logger = new Logger(MultiTradeWorker.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly singleTradeService: SingleTradeService,
    private readonly multiTradeService: MultiTradeService
  ) {}

  async handleChild(multiTrade: MultiTrade): Promise<void> {
    if (multiTrade.current === null) {
      return;
    }
    const child = multiTrade.children[multiTrade.current];
    if (!child) {
      return;
    }
    try {
      await this.handleStartChild(multiTrade, child);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return this.handleFailed(multiTrade, message);
    }
  }

  async handleStartChild(
    multiTrade: MultiTrade,
    child: MultiTradeChild
  ): Promise<void> {
    // Resolve the offerTo and offerFrom recyclables
    const offerToRecyclables = multiTrade.recyclableUserAssetIds.get(
      child.offerToUserId
    );
    const offerToRecyclable = offerToRecyclables
      ? offerToRecyclables[0]
      : undefined;
    if (offerToRecyclable === undefined) {
      throw new Error(
        `No recyclable to offer from User ${child.offerToUserId}.`
      );
    }
    const offerFromRecyclables = multiTrade.recyclableUserAssetIds.get(
      child.offerFromUserId
    );
    const offerFromRecyclable = offerFromRecyclables
      ? offerFromRecyclables[0]
      : undefined;

    // Determine the sender and accepter
    if (!multiTrade.users) {
      throw new Error("Users redacted.");
    }
    const [senderId, accepterId] =
      child.strategy === MultiTradeChildStrategy.Sender_To_Receiver
        ? [child.offerFromUserId, child.offerToUserId]
        : [child.offerToUserId, child.offerFromUserId];
    const senderDetails = multiTrade.users.get(senderId);
    if (!senderDetails) {
      throw new Error(`Details for User ${senderId} not found.`);
    }
    const accepterDetails = multiTrade.users.get(accepterId);
    if (!accepterDetails) {
      throw new Error(`Details for User ${accepterId} not found.`);
    }
    const sender = this.createSingleTradeUser(senderId, senderDetails);
    const accepter = this.createSingleTradeUser(accepterId, accepterDetails);
    const offer = this.createSingleTradeOffer(
      child.offerFromUserId,
      child.offerFromUserAssetIds,
      offerFromRecyclable
    );
    const receive = this.createSingleTradeOffer(
      child.offerToUserId,
      child.offerToUserAssetIds,
      offerToRecyclable
    );
    const singleTrade = await this.singleTradeService.prepare({
      parentId: multiTrade._id,
      sender,
      accepter,
      offers: [offer, receive],
    });

    // Update the multi-trade
    child.id = singleTrade._id;
    child.status = singleTrade.status;
    multiTrade.step = MultiTradeStep.Wait_Child;
    await this.multiTradeService.save(multiTrade);
    await this.singleTradeService.add(singleTrade);
  }

  async handleUpdateChild(
    multiTrade: MultiTrade,
    singleTrade: SingleTrade
  ): Promise<void> {
    if (multiTrade.current === null) {
      return;
    }
    const child = multiTrade.children[multiTrade.current];
    if (!child || child.id !== singleTrade._id) {
      return;
    }
    child.status = singleTrade.status;
    if (singleTrade.trade) {
      child.tradeId = singleTrade.trade.id;
      child.tradeStatus = singleTrade.trade.status;
    }
    child.startedAt = singleTrade.startedAt;
    child.processedAt = singleTrade.processedAt;
    if (singleTrade.status === SingleTradeStatus.Failed) {
      multiTrade.status = MultiTradeStatus.Failed;
      multiTrade.step = MultiTradeStep.None;
      multiTrade.error = singleTrade.error;
    } else if (singleTrade.status === SingleTradeStatus.Finished) {
      this.reconcileOffers(multiTrade, singleTrade);
      const isLastJob = multiTrade.current === multiTrade.children.length - 1;
      multiTrade.status = isLastJob
        ? MultiTradeStatus.Finished
        : MultiTradeStatus.Processing;
      multiTrade.step = isLastJob
        ? MultiTradeStep.None
        : MultiTradeStep.Start_Child;
      multiTrade.current = isLastJob ? null : multiTrade.current! + 1;
    }
    if (multiTrade.step === MultiTradeStep.None) {
      await this.handleProcessed(child, multiTrade);
    } else if (multiTrade.step === MultiTradeStep.Start_Child) {
      await this.handleChild(multiTrade);
    }
  }

  private async handleProcessed(
    lastJob: MultiTradeChild,
    multiTrade: MultiTrade
  ): Promise<void> {
    multiTrade.users = null;
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
    multiTrade.users = null;
    multiTrade.error = { statusCode: 500, message };
    multiTrade.processedAt = new Date();
    await this.multiTradeService.save(multiTrade);
    this.logger.error(`Multi-Trade ${multiTrade._id} failed: ${message}`);
    this.eventEmitter.emit(MULTI_TRADE_PROCESSED_EVENT, multiTrade);
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

  private createSingleTradeOffer(
    userId: number,
    userAssetIds: number[] | undefined,
    recyclableUserAssetId: number | undefined
  ): SingleTradeOffer {
    return {
      userId,
      userAssetIds,
      recyclableUserAssetId,
    };
  }

  private createSingleTradeUser(
    userId: number,
    userDetails: MultiTradeUser
  ): SingleTradeUser {
    return {
      id: userId,
      credentials: {
        roblosecurity: userDetails.roblosecurity,
      },
      totp: userDetails.totpSecret
        ? { secret: userDetails.totpSecret }
        : undefined,
    };
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
