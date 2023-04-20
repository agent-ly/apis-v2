import { Module } from "@nestjs/common";
import { RedisUtilModule } from "nestjs-super-redis/util";

import { BotsService } from "./bots.service.js";
import { BotItemsService } from "./bot_items.service.js";
import { BotTransactionsService } from "./bot_transactions.service.js";

@Module({
  imports: [RedisUtilModule],
  providers: [BotsService, BotItemsService, BotTransactionsService],
  exports: [BotsService, BotItemsService, BotTransactionsService],
})
export class BotsModule {}
