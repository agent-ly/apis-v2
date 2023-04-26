import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import {
  type SingleTrade,
  SingleTradeStatus,
  SingleTradeStep,
} from "./single_trade.entity.js";
import {
  SINGLE_TRADE_ADDED_EVENT,
  SINGLE_TRADE_RESUMED_EVENT,
} from "./single_trade.constants.js";
import { SingleTradeWorker } from "./single_trade.worker.js";
import { SingleTradeService } from "./single_trade.service.js";

@Injectable()
export class SingleTradeEventHost {
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

  @OnEvent(SINGLE_TRADE_RESUMED_EVENT)
  async onSingleTradeResumed(singleTrade: SingleTrade): Promise<void> {
    this.singleTradeWorker.clearTimer(singleTrade);
    await this.singleTradeWorker.handleStart(singleTrade);
  }
}
