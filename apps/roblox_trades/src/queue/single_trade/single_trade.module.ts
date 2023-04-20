import { Module } from "@nestjs/common";
import { MongoModule } from "nestjs-super-mongodb";
import { BullModule } from "@nestjs/bullmq";

import { TradesApi } from "roblox-proxy-nestjs/apis/trades.api";
import { TwoStepApi } from "roblox-proxy-nestjs/apis/two_step.api";

import { CryptModule } from "../../crypt/crypt.module.js";
import { COLLECTION_NAME, QUEUE_NAME } from "./single_trade.constants.js";
import { SingleTradeHandler } from "./single_trade.handler.js";
import { SingleTradeService } from "./single_trade.service.js";
import { SingleTradeWorker } from "./single_trade.worker.js";

@Module({
  imports: [
    MongoModule.registerCollection(COLLECTION_NAME),
    BullModule.registerQueue({
      name: QUEUE_NAME,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),
    CryptModule,
  ],
  providers: [
    TradesApi,
    TwoStepApi,
    SingleTradeHandler,
    SingleTradeService,
    SingleTradeWorker,
  ],
  exports: [SingleTradeService],
})
export class SingleTradeModule {}
