import { Module } from "@nestjs/common";
import { MongoModule } from "nestjs-super-mongodb";
import { BullModule } from "@nestjs/bullmq";

import { SingleTradeModule } from "../single_trade/single_trade.module.js";
import { COLLECTION_NAME, QUEUE_NAME } from "./multi_trade.constants.js";
import { MultiTradeService } from "./multi_trade.service.js";
import { MultiTradeWorker } from "./multi_trade.worker.js";
import { MultiTradeGateway } from "./multi_trade.gateway.js";
import { MultiTradeController } from "./multi_trade.controller.js";

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
    SingleTradeModule,
  ],
  providers: [MultiTradeService, MultiTradeWorker, MultiTradeGateway],
  controllers: [MultiTradeController],
  exports: [MultiTradeService],
})
export class MultiTradeModule {}
