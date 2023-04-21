import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { RobloxError, RobloxErrorHost } from "roblox-proxy-nestjs";
import type { TradeOfferPayload } from "roblox-proxy-nestjs/apis/trades.api";

import {
  type SingleTrade,
  SingleTradeStatus,
  SingleTradeStep,
  SingleTradeDepth,
} from "./single_trade.entity.js";
import type { SingleTradeChallengeEvent } from "./single_trade.interfaces.js";
import { SingleTradeHandler } from "./single_trade.handler.js";
import { SingleTradeService } from "./single_trade.service.js";
import {
  SINGLE_TRADE_CHALLENGE_EVENT,
  SINGLE_TRADE_UPDATED_EVENT,
} from "./single_trade.constants.js";

@Injectable()
export class SingleTradeWorker implements OnModuleInit {
  private static readonly WAIT_TRADE_DELAY = 1e3 * 2.5; // 2.5 second(s)
  private static readonly PAUSE_TRADE_DELAY = 1e3 * 60; // 1 minute(s)

  private static readonly DELAYED_TRADE_THRESHOLD = 1e3 * 60; // 1 minute(s)
  private static readonly DELAYED_TRADE_TIMEOUT = 1e3 * 60; // 1 minute(s)
  private static readonly BACKLOGGED_TRADE_THRESHOLD = 1e3 * 60 * 5; // 5 minute(s)
  private static readonly BACKLOGGED_TRADE_TIMEOUT = 1e3 * 60 * 10; // 10 minute(s)

  private readonly logger = new Logger(SingleTradeWorker.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly singleTradeUtil: SingleTradeHandler,
    private readonly singleTradeService: SingleTradeService
  ) {}

  async onModuleInit() {
    // Resume pause timers.
    await this.resumePauseTimers();
    // Resume processable.
    await this.resumeProcessable();
  }

  async resumePauseTimers(): Promise<void> {
    const singleTrades = await this.singleTradeService.findPaused();
    if (singleTrades.length === 0) {
      return;
    }
    this.logger.debug(
      `Resuming ${singleTrades.length} Single-Trade(s) pause timers...`
    );
    const handleTimeouts = [];
    for (const singleTrade of singleTrades) {
      const timeLeft =
        SingleTradeWorker.PAUSE_TRADE_DELAY -
        (Date.now() - singleTrade.updatedAt.getTime());
      if (timeLeft <= 0) {
        handleTimeouts.push(
          this.handleFailed(singleTrade, new Error("Pause timed out."))
        );
      } else {
        setTimeout(() => this.handlePauseTimeout(singleTrade._id), timeLeft);
      }
    }
    if (handleTimeouts.length > 0) {
      await Promise.all(handleTimeouts);
    }
  }

  async resumeProcessable(): Promise<void> {
    const singleTrades = await this.singleTradeService.findProcessable();
    if (singleTrades.length === 0) {
      return;
    }
    this.logger.log(`Resuming ${singleTrades.length} Single-Trade(s)...`);
    const processing = [];
    for (const singleTrade of singleTrades) {
      const processor =
        singleTrade.step === SingleTradeStep.Start_Trade
          ? this.handleStart(singleTrade)
          : this.handleWait(singleTrade);
      processing.push(processor);
    }
    await Promise.all(processing);
  }

  async handleStart(singleTrade: SingleTrade): Promise<void> {
    if (
      singleTrade.step !== SingleTradeStep.Start_Trade ||
      !singleTrade.sender ||
      !singleTrade.accepter
    ) {
      return this.handleFailed(singleTrade, new Error("State invalid."));
    }
    try {
      // Step 1. Send trade
      if (!singleTrade.trade) {
        singleTrade.depth = SingleTradeDepth.Send_Trade;
        await this.singleTradeService.save(singleTrade);
        const [offer, receive] = this.prepareOffers(singleTrade);
        this.logger.debug(
          `User ${singleTrade.sender.id} sending trade to ${singleTrade.accepter.id}...`
        );
        const tradeId = await this.singleTradeUtil.trySendTrade({
          user: singleTrade.sender,
          offer,
          receive,
        });
        singleTrade.trade = { id: tradeId, status: "Unknown" };
        await this.singleTradeService.save(singleTrade);
      }
      // Step 2. Accept trade
      singleTrade.depth = SingleTradeDepth.Accept_Trade;
      await this.singleTradeService.save(singleTrade);
      this.logger.debug(
        `User ${singleTrade.accepter.id} accepting trade ${singleTrade.trade.id}...`
      );
      const status = await this.singleTradeUtil.tryAcceptTrade({
        user: singleTrade.accepter,
        tradeId: singleTrade.trade.id,
      });
      singleTrade.trade.status = status;
      if (status === "Completed" || status === "InterventionRequired") {
        return this.handleFinished(singleTrade);
      }
      singleTrade.step = SingleTradeStep.Wait_Trade;
      singleTrade.depth = SingleTradeDepth.None;
      await this.singleTradeService.save(singleTrade);
    } catch (error) {
      if (
        RobloxErrorHost.isRobloxError(error) &&
        error.name === "TradeChallengeError"
      ) {
        return this.handlePause(singleTrade);
      } else {
        this.logger.error(`Failed to start Single-Trade ${singleTrade._id}.`);
        return this.handleFailed(singleTrade, error as Error);
      }
    }
    setTimeout(
      () => this.handleWait(singleTrade),
      SingleTradeWorker.WAIT_TRADE_DELAY
    );
  }

  async handleWait(singleTrade: SingleTrade): Promise<void> {
    if (
      singleTrade.step !== SingleTradeStep.Wait_Trade ||
      !singleTrade.sender ||
      !singleTrade.sender.credentials ||
      !singleTrade.accepter ||
      !singleTrade.accepter.credentials ||
      !singleTrade.trade ||
      !singleTrade.startedAt
    ) {
      return this.handleFailed(singleTrade, new Error("State invalid."));
    }
    try {
      // Step 1. Get trade status
      singleTrade.depth = SingleTradeDepth.Check_Trade_As_Sender;
      await this.singleTradeService.save(singleTrade);
      let trade = await this.singleTradeUtil.tryGetTrade(
        singleTrade.sender.credentials.roblosecurity,
        singleTrade.trade.id
      );
      let status = trade.status;
      singleTrade.trade.status = status;
      if (status === "Unknown") {
        singleTrade.depth = SingleTradeDepth.Check_Trade_As_Accepter;
        await this.singleTradeService.save(singleTrade);
        trade = await this.singleTradeUtil.tryGetTrade(
          singleTrade.accepter.credentials.roblosecurity,
          singleTrade.trade.id
        );
        status = trade.status;
        singleTrade.trade.status = status;
      }
      // Step 2. Check if trade has finished/failed
      if (status === "Completed" || status === "InterventionRequired") {
        return this.handleFinished(singleTrade);
      } else if (status !== "Pending" && status !== "Processing") {
        return this.handleFailed(
          singleTrade,
          new Error(`Trade failed: ${status}`)
        );
      }
      // Step 3. Check if trade is delayed
      if (
        singleTrade.status !== SingleTradeStatus.Backlogged &&
        singleTrade.status !== SingleTradeStatus.Delayed
      ) {
        const timeElapsed = Date.now() - singleTrade.startedAt.getTime();
        if (timeElapsed > SingleTradeWorker.BACKLOGGED_TRADE_THRESHOLD) {
          singleTrade.status = SingleTradeStatus.Backlogged;
          this.logger.warn(`Trade ${singleTrade.trade.id} is backlogged.`);
        } else if (timeElapsed > SingleTradeWorker.DELAYED_TRADE_THRESHOLD) {
          singleTrade.status = SingleTradeStatus.Delayed;
          this.logger.warn(`Trade ${singleTrade.trade.id} is delayed.`);
        }
      }
      singleTrade.depth = SingleTradeDepth.None;
      await this.singleTradeService.save(singleTrade);
      this.handleUpdated(singleTrade);
    } catch (error) {
      this.logger.error(`Failed to check Single-Trade ${singleTrade._id}.`);
      return this.handleFailed(singleTrade, error as Error | RobloxError);
    }
    const delay =
      singleTrade.status === SingleTradeStatus.Backlogged
        ? SingleTradeWorker.BACKLOGGED_TRADE_TIMEOUT
        : singleTrade.status === SingleTradeStatus.Delayed
        ? SingleTradeWorker.DELAYED_TRADE_TIMEOUT
        : SingleTradeWorker.WAIT_TRADE_DELAY;
    setTimeout(() => this.handleWait(singleTrade), delay);
  }

  private async handlePause(singleTrade: SingleTrade): Promise<void> {
    singleTrade.status = SingleTradeStatus.Paused;
    await this.singleTradeService.save(singleTrade);
    this.handleUpdated(singleTrade);
    const singleTradeId = singleTrade._id;
    const userId =
      singleTrade.depth === SingleTradeDepth.Send_Trade
        ? singleTrade.sender!.id
        : singleTrade.accepter!.id;
    const event: SingleTradeChallengeEvent = {
      singleTradeId,
      userId,
    };
    this.eventEmitter.emit(SINGLE_TRADE_CHALLENGE_EVENT, event);
    this.logger.debug(`Single-Trade ${singleTrade._id} paused.`);
    setTimeout(
      () => this.handlePauseTimeout(singleTradeId),
      SingleTradeWorker.PAUSE_TRADE_DELAY
    );
  }

  private async handlePauseTimeout(singleTradeId: string): Promise<void> {
    const singleTrade = await this.singleTradeService.findById(singleTradeId);
    if (!singleTrade) {
      return this.logger.warn(
        `Single-Trade ${singleTradeId} not found when handling pause timeout.`
      );
    }
    if (singleTrade.status === SingleTradeStatus.Paused) {
      await this.handleFailed(singleTrade, new Error("Trade pause timed out."));
    }
  }

  private async handleFinished(singleTrade: SingleTrade): Promise<void> {
    singleTrade.status = SingleTradeStatus.Finished;
    singleTrade.step = SingleTradeStep.None;
    singleTrade.depth = SingleTradeDepth.None;
    singleTrade.sender = null;
    singleTrade.accepter = null;
    singleTrade.processedAt = new Date();
    await this.singleTradeService.save(singleTrade);
    this.logger.debug(`Single-Trade ${singleTrade._id} finished.`);
    this.handleUpdated(singleTrade);
  }

  private async handleFailed(
    singleTrade: SingleTrade,
    error: Error | RobloxError
  ): Promise<void> {
    singleTrade.status = SingleTradeStatus.Failed;
    singleTrade.sender = null;
    singleTrade.accepter = null;
    if (!RobloxErrorHost.isRobloxErrorLike(error)) {
      error = { statusCode: 500, message: error.message };
    }
    singleTrade.error = error;
    singleTrade.processedAt = new Date();
    await this.singleTradeService.save(singleTrade);
    this.logger.error(`Single-Trade ${singleTrade._id} failed.`);
    this.handleUpdated(singleTrade);
  }

  private handleUpdated(singleTrade: SingleTrade): void {
    this.eventEmitter.emit(SINGLE_TRADE_UPDATED_EVENT, singleTrade);
  }

  private prepareOffers(singleTrade: SingleTrade): TradeOfferPayload[] {
    return singleTrade.offers.map((offer) => {
      const actualOffer = {
        userId: offer.userId,
        userAssetIds: [] as number[],
      };
      if (offer.userAssetIds !== undefined && offer.userAssetIds.length > 0) {
        actualOffer.userAssetIds.push(...offer.userAssetIds);
      }
      if (offer.recyclableUserAssetId !== undefined) {
        actualOffer.userAssetIds.push(offer.recyclableUserAssetId);
      }
      if (actualOffer.userAssetIds.length === 0) {
        throw new Error(`No user assets in offer from User ${offer.userId}.`);
      }
      if (actualOffer.userAssetIds.length > 4) {
        throw new Error(
          `Too many user assets in offer from User ${offer.userId}.`
        );
      }
      return actualOffer;
    });
  }
}
