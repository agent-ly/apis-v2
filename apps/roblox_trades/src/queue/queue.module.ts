import { Module } from "@nestjs/common";

import { CryptModule } from "../crypt/crypt.module.js";
import { MultiTradeModule } from "./multi_trade/multi_trade.module.js";
import { QueueService } from "./queue.service.js";
import { QueueController } from "./queue.controller.js";

@Module({
  imports: [CryptModule, MultiTradeModule],
  providers: [QueueService],
  controllers: [QueueController],
})
export class QueueModule {}
