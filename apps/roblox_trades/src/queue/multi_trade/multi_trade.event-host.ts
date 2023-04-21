import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import type { SingleTrade } from "../single_trade/single_trade.entity.js";
import { SINGLE_TRADE_UPDATED_EVENT } from "../single_trade/single_trade.constants.js";
import {
  type MultiTrade,
  MultiTradeStatus,
  MultiTradeStep,
} from "./multi_trade.entity.js";
import { MULTI_TRADE_ADDED_EVENT } from "./multi_trade.constants.js";
import { MultiTradeWorker } from "./multi_trade.worker.js";
import { MultiTradeService } from "./multi_trade.service.js";

@Injectable()
export class MultiTradeEventHost {
  constructor(
    private readonly multiTradeWorker: MultiTradeWorker,
    private readonly multiTradeService: MultiTradeService
  ) {}

  @OnEvent(MULTI_TRADE_ADDED_EVENT)
  async onMultiTradeAdded(multiTrade: MultiTrade): Promise<void> {
    multiTrade.status = MultiTradeStatus.Processing;
    multiTrade.step = MultiTradeStep.Start_Child;
    multiTrade.current = 0;
    multiTrade.startedAt = new Date();
    await this.multiTradeService.save(multiTrade);
    await this.multiTradeWorker.handleChild(multiTrade);
  }

  @OnEvent(SINGLE_TRADE_UPDATED_EVENT)
  async onSingleTradeUpdated(singleTrade: SingleTrade): Promise<void> {
    const multiTrade = await this.multiTradeService.findById(
      singleTrade.parentId
    );
    if (!multiTrade) {
      return;
    }
    await this.multiTradeWorker.handleUpdateChild(multiTrade, singleTrade);
  }
}
