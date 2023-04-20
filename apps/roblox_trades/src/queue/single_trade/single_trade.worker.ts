import { Logger } from "@nestjs/common";
import { WorkerHost, Processor } from "@nestjs/bullmq";
import { DelayedError, type Job } from "bullmq";
import type { NormalizedRobloxApiError } from "roblox-proxy-nestjs";
import type { TradeOfferPayload } from "roblox-proxy-nestjs/apis/trades.api";

import { CryptService } from "../../crypt/crypt.service.js";
import {
  type SingleTrade,
  SingleTradeStatus,
  SingleTradeStep,
  SingleTradeDepth,
} from "./single_trade.entity.js";
import type { SingleTradeJobData } from "./single_trade.interfaces.js";
import { QUEUE_NAME } from "./single_trade.constants.js";
import { SingleTradeHandler } from "./single_trade.handler.js";
import { SingleTradeService } from "./single_trade.service.js";

@Processor(QUEUE_NAME)
export class SingleTradeWorker extends WorkerHost {
  private static readonly SEND_TRADE_DELAY = 1e3 * 5; // 5 second(s)
  private static readonly WAIT_TRADE_DELAY = 1e3 * 5; // 5 second(s)
  private static readonly DELAYED_TRADE_THRESHOLD = 1e3 * 60; // 1 minute(s)
  private static readonly DELAYED_TRADE_TIMEOUT = 1e3 * 60; // 1 minute(s)
  private static readonly BACKLOGGED_TRADE_THRESHOLD = 1e3 * 60 * 5; // 5 minute(s)
  private static readonly BACKLOGGED_TRADE_TIMEOUT = 1e3 * 60 * 25; // 25 minute(s)

  private readonly logger = new Logger(SingleTradeWorker.name);

  constructor(
    private readonly cryptService: CryptService,
    private readonly singleTradeUtil: SingleTradeHandler,
    private readonly singleTradeService: SingleTradeService
  ) {
    super();
  }

  async process(job: Job<SingleTradeJobData>): Promise<void> {
    this.logger.debug(`Processing job ${job.id}...`);
    const singleTradeId = job.data.singleTradeId;
    const singleTrade = await this.singleTradeService.findById(singleTradeId);
    if (!singleTrade) {
      return this.logger.error(`Single-Trade ${singleTradeId} not found.`);
    }
    try {
      if (singleTrade.step === SingleTradeStep.None) {
        singleTrade.status = SingleTradeStatus.Processing;
        singleTrade.step = SingleTradeStep.Start_Trade;
        await this.singleTradeService.save(singleTrade);
        this.logger.debug(`Initialized Single-Trade ${singleTrade._id}.`);
      }
      if (singleTrade.step === SingleTradeStep.Start_Trade) {
        await this.handleStart(job, singleTrade);
      } else if (singleTrade.step === SingleTradeStep.Wait_Trade) {
        await this.handleWait(job, singleTrade);
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

  async handleStart(
    job: Job<SingleTradeJobData>,
    singleTrade: SingleTrade
  ): Promise<void> {
    singleTrade.depth = SingleTradeDepth.Prepare_Trade;
    singleTrade.startedAt = new Date();
    await this.singleTradeService.save(singleTrade);
    this.logger.debug(`Starting Single-Trade ${singleTrade._id}...`);

    try {
      this.ensureCredentialsAvailable(singleTrade);
      const [senderRoblosecurity, accepterRoblosecurity] =
        this.handleDecryptRoblosecurities(singleTrade);
      const [senderTotpSecret, accepterTotpSecret] =
        this.handleDecryptTotpSecrets(singleTrade);

      // Step 1. Send trade
      singleTrade.depth = SingleTradeDepth.Send_Trade;
      await this.singleTradeService.save(singleTrade);
      const [offer, receive] = this.prepareTradeOffers(singleTrade);
      const tradeId = await this.singleTradeUtil.trySendTrade({
        userId: singleTrade.sender.id,
        roblosecurity: senderRoblosecurity,
        totpSecret: senderTotpSecret,
        offer,
        receive,
      });
      singleTrade.trade = { id: tradeId, status: "Unknown" };
      await this.worker.delay(SingleTradeWorker.SEND_TRADE_DELAY);

      // Step 2. Accept trade
      singleTrade.depth = SingleTradeDepth.Accept_Trade;
      await this.singleTradeService.save(singleTrade);
      this.logger.debug(
        `Accepting Trade ${tradeId} as User ${singleTrade.accepter.id}...`
      );
      const status = await this.singleTradeUtil.tryAcceptTrade({
        tradeId: tradeId,
        userId: singleTrade.accepter.id,
        roblosecurity: accepterRoblosecurity,
        totpSecret: accepterTotpSecret,
      });
      singleTrade.trade.status = status;
      if (status === "Completed" || status === "InterventionRequired") {
        return this.handleFinished(singleTrade);
      }
      singleTrade.step = SingleTradeStep.Wait_Trade;
      singleTrade.depth = SingleTradeDepth.None;
      await this.singleTradeService.save(singleTrade);
    } catch (error) {
      this.logger.error(`Failed to start Single-Trade ${singleTrade._id}.`);
      return this.handleFailed(singleTrade, error as Error);
    }

    await job.moveToDelayed(0, job.token);
    throw new DelayedError();
  }

  async handleWait(
    job: Job<SingleTradeJobData>,
    singleTrade: SingleTrade
  ): Promise<void> {
    if (!singleTrade.startedAt) {
      return this.handleFailed(singleTrade, new Error("Not started."));
    }
    if (!singleTrade.trade) {
      return this.handleFailed(singleTrade, new Error("Trade not started."));
    }
    this.logger.debug(
      `Checking Trade ${singleTrade.trade.id} as User ${singleTrade.sender.id}...`
    );

    try {
      this.ensureCredentialsAvailable(singleTrade);
      const [senderRoblosecurity, accepterRoblosecurity] =
        this.handleDecryptRoblosecurities(singleTrade);

      // Step 1. Get trade status
      singleTrade.depth = SingleTradeDepth.Check_Trade_As_Sender;
      await this.singleTradeService.save(singleTrade);
      let trade = await this.singleTradeUtil.tryGetTrade(
        senderRoblosecurity,
        singleTrade.trade.id
      );
      let status = trade.status;
      singleTrade.trade.status = status;
      await this.singleTradeService.save(singleTrade);
      if (status === "Unknown") {
        this.logger.warn(
          `Could not determine Trade ${singleTrade.trade.id} status as User ${singleTrade.sender.id}, retrying as User ${singleTrade.accepter.id}...`
        );
        singleTrade.depth = SingleTradeDepth.Check_Trade_As_Accepter;
        await this.singleTradeService.save(singleTrade);
        trade = await this.singleTradeUtil.tryGetTrade(
          accepterRoblosecurity,
          singleTrade.trade.id
        );
        status = trade.status;
        singleTrade.trade.status = status;
        await this.singleTradeService.save(singleTrade);
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
    } catch (error) {
      this.logger.error(`Failed to check Single-Trade ${singleTrade._id}.`);
      return this.handleFailed(
        singleTrade,
        error as Error | NormalizedRobloxApiError
      );
    }

    let delay =
      singleTrade.status === SingleTradeStatus.Backlogged
        ? SingleTradeWorker.BACKLOGGED_TRADE_TIMEOUT
        : singleTrade.status === SingleTradeStatus.Delayed
        ? SingleTradeWorker.DELAYED_TRADE_TIMEOUT
        : SingleTradeWorker.WAIT_TRADE_DELAY;
    const timestamp = Date.now() + delay;
    await job.moveToDelayed(timestamp, job.token);
    throw new DelayedError();
  }

  private async handleFinished(singleTrade: SingleTrade): Promise<void> {
    singleTrade.status = SingleTradeStatus.Finished;
    singleTrade.step = SingleTradeStep.None;
    singleTrade.depth = SingleTradeDepth.None;
    this.handleRedactCredentials(singleTrade);
    singleTrade.processedAt = new Date();
    await this.singleTradeService.save(singleTrade);
    this.logger.debug(`Single-Trade ${singleTrade._id} finished.`);
  }

  private async handleFailed(
    singleTrade: SingleTrade,
    error: Error | NormalizedRobloxApiError
  ): Promise<void> {
    singleTrade.status = SingleTradeStatus.Failed;
    this.handleRedactCredentials(singleTrade);
    singleTrade.error =
      error.name == "TradeSendError" || error.name == "TradeAcceptError"
        ? (error as NormalizedRobloxApiError)
        : {
            statusCode: 500,
            errorCode: -1,
            message: error.message,
          };
    singleTrade.processedAt = new Date();
    await this.singleTradeService.save(singleTrade);
    this.logger.error(
      `Single-Trade ${singleTrade._id} failed: ${error.message}`
    );
  }

  private prepareTradeOffers(singleTrade: SingleTrade): TradeOfferPayload[] {
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

  private handleRedactCredentials(singleTrade: SingleTrade): void {
    singleTrade.sender.credentials = null;
    singleTrade.accepter.credentials = null;
  }

  private handleDecryptRoblosecurities(
    singleTrade: SingleTrade
  ): [string, string] {
    return [
      this.cryptService.decrypt(singleTrade.sender.credentials!.roblosecurity),
      this.cryptService.decrypt(
        singleTrade.accepter.credentials!.roblosecurity
      ),
    ];
  }

  private handleDecryptTotpSecrets(
    singleTrade: SingleTrade
  ): [string | undefined, string | undefined] {
    return [
      singleTrade.sender.credentials!.totpSecret
        ? this.cryptService.decrypt(singleTrade.sender.credentials!.totpSecret)
        : undefined,
      singleTrade.accepter.credentials!.totpSecret
        ? this.cryptService.decrypt(
            singleTrade.accepter.credentials!.totpSecret
          )
        : undefined,
    ];
  }

  private ensureCredentialsAvailable(singleTrade: SingleTrade): void {
    if (!singleTrade.sender.credentials) {
      throw new Error("Sender credentials redacted.");
    }
    if (!singleTrade.accepter.credentials) {
      throw new Error("Accepter credentials redacted.");
    }
  }
}
