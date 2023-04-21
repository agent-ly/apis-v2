import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import {
  type SingleTrade,
  SingleTradeDepth,
  SingleTradeStatus,
  SingleTradeStep,
} from "./single_trade.entity.js";
import type { SingleTradeAuthorizeEvent } from "./single_trade.interfaces.js";
import {
  SINGLE_TRADE_ADDED_EVENT,
  SINGLE_TRADE_AUTHORIZE_EVENT,
} from "./single_trade.constants.js";
import { SingleTradeWorker } from "./single_trade.worker.js";
import { SingleTradeService } from "./single_trade.service.js";

@Injectable()
export class SingleTradeEventHost {
  private readonly logger = new Logger(SingleTradeEventHost.name);

  constructor(
    private readonly singleTradeService: SingleTradeService,
    private readonly singleTradeWorker: SingleTradeWorker
  ) {}

  @OnEvent(SINGLE_TRADE_ADDED_EVENT)
  async onSingleTradeAdded(singleTrade: SingleTrade): Promise<void> {
    singleTrade.status = SingleTradeStatus.Processing;
    singleTrade.step = SingleTradeStep.Start_Trade;
    singleTrade.startedAt = new Date();
    await this.singleTradeService.save(singleTrade);
    await this.singleTradeWorker.handleStart(singleTrade);
  }

  @OnEvent(SINGLE_TRADE_AUTHORIZE_EVENT)
  async onSingleTradeAuthorized(payload: SingleTradeAuthorizeEvent) {
    const singleTrade = await this.singleTradeService.findById(
      payload.singleTradeId
    );
    if (!singleTrade) {
      return this.logger.warn(
        `Single-Trade ${payload.singleTradeId} not found.`
      );
    }
    if (singleTrade.status !== SingleTradeStatus.Paused) {
      return this.logger.warn(
        `Single-Trade ${payload.singleTradeId} not paused.`
      );
    }
    const user =
      singleTrade.depth === SingleTradeDepth.Send_Trade
        ? singleTrade.sender
        : singleTrade.accepter;
    if (!user) {
      return this.logger.warn(
        `Single-Trade ${payload.singleTradeId} active user not defined.`
      );
    }
    if (user.id !== payload.userId) {
      return this.logger.warn(
        `Single-Trade ${payload.singleTradeId} active user expected ${user.id} but got ${payload.userId}.`
      );
    }
    if (!user.totp) {
      user.totp = {};
    }
    if (payload.secret) {
      user.totp.secret = payload.secret;
    }
    if (payload.code) {
      user.totp.code = payload.code;
    }
    singleTrade.status = SingleTradeStatus.Processing;
    await this.singleTradeService.save(singleTrade);
    await this.singleTradeWorker.handleStart(singleTrade);
  }
}
