import { Module } from "@nestjs/common";
import { MongoModule } from "nestjs-super-mongodb";

import { TradesApi } from "roblox-proxy-nestjs/apis/trades.api";
import { TwoStepApi } from "roblox-proxy-nestjs/apis/two_step.api";

import { CryptModule } from "../../crypt/crypt.module.js";
import { COLLECTION_NAME } from "./single_trade.constants.js";
import { SingleTradeHandler } from "./single_trade.handler.js";
import { SingleTradeService } from "./single_trade.service.js";
import { SingleTradeWorker } from "./single_trade.worker.js";
import { SingleTradeEventHost } from "./single_trade.event-host.js";
import { SingleTradeGateway } from "./single_trade.gateway.js";

@Module({
  imports: [MongoModule.registerCollection(COLLECTION_NAME), CryptModule],
  providers: [
    TradesApi,
    TwoStepApi,
    SingleTradeHandler,
    SingleTradeService,
    SingleTradeWorker,
    SingleTradeEventHost,
    SingleTradeGateway,
  ],
  exports: [SingleTradeService],
})
export class SingleTradeModule {}
