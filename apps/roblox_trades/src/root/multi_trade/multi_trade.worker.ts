import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";

import {
  type SingleTrade,
  type SingleTradeOffer,
  SingleTradeStatus,
  type SingleTradeUser,
  SingleTradeResult,
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

  async handleProcessChild(multiTrade: MultiTrade): Promise<void> {
    if (multiTrade.current === null) {
      return this.handleFailed(multiTrade, "Invalid state (0).");
    }
    const child = multiTrade.children[multiTrade.current];
    if (!child) {
      return this.handleFailed(multiTrade, "Invalid state (1).");
    }
    try {
      await this.handleStartChild(multiTrade, child);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error.";
      return this.handleFailed(multiTrade, message);
    }
  }

  async handleStartChild(
    multiTrade: MultiTrade,
    child: MultiTradeChild
  ): Promise<void> {
    // We take a lot of assumptions here considering that there should only be one method of processing a multi-trade.
    if (!multiTrade.users) {
      throw new Error("Invalid state (3).");
    }
    const [senderId, accepterId] =
        child.strategy === MultiTradeChildStrategy.Sender_To_Receiver
          ? [child.fromUserId, child.toUserId]
          : [child.toUserId, child.fromUserId],
      [senderUser, accepterUser] = [
        multiTrade.users.get(senderId),
        multiTrade.users.get(accepterId),
      ];
    if (!senderUser || !accepterUser) {
      throw new Error("Invalid state (4).");
    }
    const offerRecyclableUserAssetId = this.getRecyclableUserAssetId(
      child.fromUserId,
      multiTrade
    );
    if (!offerRecyclableUserAssetId) {
      throw new Error("Invalid state (5).");
    }
    const receiveRecyclableUserAssetId = this.getRecyclableUserAssetId(
      child.toUserId,
      multiTrade
    );
    const sender = this.createSingleTradeUser(senderId, senderUser);
    const accepter = this.createSingleTradeUser(accepterId, accepterUser);
    const offer = this.createSingleTradeOffer(
      child.fromUserId,
      child.userAssetIds,
      offerRecyclableUserAssetId
    );
    const receive = this.createSingleTradeOffer(
      child.toUserId,
      undefined,
      receiveRecyclableUserAssetId
    );
    const singleTrade = await this.singleTradeService.prepare({
      parentId: multiTrade._id,
      sender,
      accepter,
      offers: [offer, receive],
    });
    child.id = singleTrade._id;
    child.status = singleTrade.status;
    multiTrade.step = MultiTradeStep.Wait_Child;
    await this.multiTradeService.save(multiTrade);
    await this.singleTradeService.add(singleTrade);
    this.logger.debug(
      `Multi-Trade ${multiTrade._id} child started (${multiTrade.current}).`
    );
  }

  async handleUpdatedChild(
    multiTrade: MultiTrade,
    singleTrade: SingleTrade
  ): Promise<void> {
    if (multiTrade.current === null) {
      return this.handleFailed(multiTrade, "Invalid state (6).");
    }
    if (singleTrade.status === SingleTradeStatus.Processed) {
      if (singleTrade.result === SingleTradeResult.Finished) {
        this.handleFinishedChild(multiTrade, singleTrade);
      } else if (
        singleTrade.result === SingleTradeResult.Failed &&
        singleTrade.error &&
        singleTrade.error.field === "userId" &&
        (typeof singleTrade.error.fieldData === "string" ||
          typeof singleTrade.error.fieldData === "number")
      ) {
        const userId =
          typeof singleTrade.error.fieldData === "string"
            ? parseInt(singleTrade.error.fieldData)
            : singleTrade.error.fieldData;
        const user = multiTrade.users?.get(userId);
        if (!user) {
          return this.handleFailed(multiTrade, "Invalid state (7).");
        }
        // ? Should we filter here? Or apply a booelan property?
        // Filtering reduces code complexity.
        const currentChild = multiTrade.children[multiTrade.current];
        multiTrade.children = multiTrade.children.filter(
          (child) =>
            child === currentChild ||
            (child.fromUserId !== userId && child.toUserId !== userId)
        );
        multiTrade.current = multiTrade.children.indexOf(currentChild);
      }
      const isLastChild = multiTrade.current === multiTrade.children.length - 1,
        [newStatus, newStep, newCurrent] = isLastChild
          ? [MultiTradeStatus.Finished, MultiTradeStep.None, null]
          : [
              MultiTradeStatus.Processing,
              MultiTradeStep.Process_Child,
              multiTrade.current + 1,
            ];
      multiTrade.status = newStatus;
      multiTrade.step = newStep;
      multiTrade.current = newCurrent;
      if (multiTrade.step === MultiTradeStep.None) {
        return this.handleFinished(multiTrade);
      } else if (multiTrade.step === MultiTradeStep.Process_Child) {
        return this.handleProcessChild(multiTrade);
      }
    }
    await this.multiTradeService.save(multiTrade);
    this.logger.debug(
      `Multi-Trade ${multiTrade._id} child updated (${multiTrade.current}).`
    );
  }

  private handleFinishedChild(
    multiTrade: MultiTrade,
    singleTrade: SingleTrade
  ): void {
    const [offer, receive] = singleTrade.offers;
    this.reconileUserAssetIds(multiTrade, offer, receive);
    this.reconcileRecyclableUserAssetIds(multiTrade, offer, receive);
    this.logger.debug(
      `Multi-Trade ${multiTrade._id} child finished (${multiTrade.current}).`
    );
  }

  private async handleFinished(multiTrade: MultiTrade): Promise<void> {
    multiTrade.users = null;
    multiTrade.processedAt = new Date();
    await this.multiTradeService.save(multiTrade);
    this.logger.debug(`Multi-Trade ${multiTrade._id} finished.`);
    this.eventEmitter.emit(MULTI_TRADE_PROCESSED_EVENT, multiTrade);
  }

  private async handleFailed(
    multiTrade: MultiTrade,
    message: string
  ): Promise<void> {
    multiTrade.users = null;
    multiTrade.error = message;
    multiTrade.processedAt = new Date();
    await this.multiTradeService.save(multiTrade);
    this.logger.error(`Multi-Trade ${multiTrade._id} failed: ${message}`);
    this.eventEmitter.emit(MULTI_TRADE_PROCESSED_EVENT, multiTrade);
  }

  private reconileUserAssetIds(
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

  private reconcileRecyclableUserAssetIds(
    multiTrade: MultiTrade,
    offer: SingleTradeOffer,
    receive: SingleTradeOffer
  ): void {
    const offerRecyclableUserAssetIds = offer.recyclableUserAssetId
        ? [offer.recyclableUserAssetId]
        : [],
      receiveRecyclableUserAssetIds = receive.recyclableUserAssetId
        ? [receive.recyclableUserAssetId]
        : [];
    modifyMapArray(multiTrade.recyclableUserAssetIds, {
      key: offer.userId,
      remove: offerRecyclableUserAssetIds,
      add: receiveRecyclableUserAssetIds,
    });
    modifyMapArray(multiTrade.recyclableUserAssetIds, {
      key: receive.userId,
      remove: receiveRecyclableUserAssetIds,
      add: offerRecyclableUserAssetIds,
    });
  }

  private getRecyclableUserAssetId(
    userId: number,
    multiTrade: MultiTrade
  ): number | undefined {
    const recyclableUserAssetIds =
      multiTrade.recyclableUserAssetIds.get(userId);
    return recyclableUserAssetIds ? recyclableUserAssetIds[0] : undefined;
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
    user: MultiTradeUser
  ): SingleTradeUser {
    return {
      id: userId,
      credentials: {
        roblosecurity: user.roblosecurity,
      },
      totp: user.roblosecret ? { secret: user.roblosecret } : undefined,
    };
  }
}

interface ModifyMapArrayOptions<TKey, TValue> {
  key: TKey;
  remove?: TValue[];
  add?: TValue[];
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
