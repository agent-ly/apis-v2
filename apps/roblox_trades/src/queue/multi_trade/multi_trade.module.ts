import { Module } from "@nestjs/common";
import { MongoModule } from "nestjs-super-mongodb";

import { CryptModule } from "../../crypt/crypt.module.js";
import { SingleTradeModule } from "../single_trade/single_trade.module.js";
import { COLLECTION_NAME } from "./multi_trade.constants.js";
import { MultiTradeService } from "./multi_trade.service.js";
import { MultiTradeWorker } from "./multi_trade.worker.js";
import { MultiTradeEventHost } from "./multi_trade.event-host.js";
import { MultiTradeGateway } from "./multi_trade.gateway.js";
import { MultiTradeController } from "./multi_trade.controller.js";

@Module({
  imports: [
    MongoModule.registerCollection(COLLECTION_NAME),
    CryptModule,
    SingleTradeModule,
  ],
  providers: [
    MultiTradeService,
    MultiTradeWorker,
    MultiTradeEventHost,
    MultiTradeGateway,
  ],
  controllers: [MultiTradeController],
  exports: [MultiTradeService],
})
export class MultiTradeModule {}
