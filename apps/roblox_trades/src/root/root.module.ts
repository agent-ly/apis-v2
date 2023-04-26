import { Module } from "@nestjs/common";

import { CryptModule } from "../crypt/crypt.module.js";
import { MultiTradeModule } from "./multi_trade/multi_trade.module.js";
import { RootService } from "./root.service.js";
import { RootController } from "./root.controller.js";

@Module({
  imports: [CryptModule, MultiTradeModule],
  providers: [RootService],
  controllers: [RootController],
})
export class RootModule {}
