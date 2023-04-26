import { Injectable, Logger } from "@nestjs/common";
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
  private readonly logger = new Logger(MultiTradeEventHost.name);

  constructor(
    private readonly multiTradeWorker: MultiTradeWorker,
    private readonly multiTradeService: MultiTradeService
  ) {}

  @OnEvent(MULTI_TRADE_ADDED_EVENT)
  async onMultiTradeAdded(multiTrade: MultiTrade): Promise<void> {
    multiTrade.status = MultiTradeStatus.Processing;
    multiTrade.step = MultiTradeStep.Process_Child;
    multiTrade.current = 0;
    multiTrade.startedAt = new Date();
    await this.multiTradeService.save(multiTrade);
    await this.multiTradeWorker.handleProcessChild(multiTrade);
  }

  @OnEvent(SINGLE_TRADE_UPDATED_EVENT)
  async onSingleTradeUpdated(singleTrade: SingleTrade): Promise<void> {
    const multiTrade = await this.multiTradeService.findById(
      singleTrade.parentId
    );
    if (!multiTrade) {
      return this.logger.warn(
        `Multi-Trade ${singleTrade.parentId} not found as parent of Single-Trade ${singleTrade._id}.`
      );
    }
    if (multiTrade.current === null) {
      return this.logger.warn(
        `Multi-Trade ${multiTrade._id} has no current child.`
      );
    }
    const child = multiTrade.children[multiTrade.current];
    if (singleTrade._id !== child.id) {
      return this.logger.warn(
        `Multi-Trade ${multiTrade._id} has current child ${child.id} but Single-Trade ${singleTrade._id} is not it.`
      );
    }
    child.result = singleTrade.result;
    child.status = singleTrade.status;
    if (singleTrade.trade) {
      child.tradeId = singleTrade.trade.id;
      child.tradeStatus = singleTrade.trade.status;
    }
    child.error = singleTrade.error;
    child.startedAt = singleTrade.startedAt;
    child.processedAt = singleTrade.processedAt;
    await this.multiTradeService.save(multiTrade);
    await this.multiTradeWorker.handleUpdatedChild(multiTrade, singleTrade);
  }
}
