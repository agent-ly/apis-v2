import { Module } from "@nestjs/common";
import { MongoModule } from "nestjs-super-mongodb";
import { RedisUtilModule } from "nestjs-super-redis/util";

import { RobloxModule } from "../roblox/roblox.module.js";
import { DbItemsModule } from "../items/db_items/db_items.module.js";
import { ItemTransactionsModule } from "../items/item_transactions/item_transactions.module.js";
import { ItemsModule } from "../items/items.module.js";
import { COLLECTION_NAME } from "./bots.constants.js";
import { BotsService } from "./bots.service.js";
import { BotsController } from "./bots.controller.js";
import { BotItemsService } from "./bot_items/bot_items.service.js";
import { BotItemsController } from "./bot_items/bot_items.controller.js";
import { BotTransactionsService } from "./bot_transactions/bot_transactions.service.js";
import { BotTransactionsEventHost } from "./bot_transactions/bot_transactions.event-host.js";
import { BotTransactionsController } from "./bot_transactions/bot_transactions.controller.js";

@Module({
  imports: [
    MongoModule.registerCollection(COLLECTION_NAME),
    RedisUtilModule.register(),
    RobloxModule,
    DbItemsModule,
    ItemTransactionsModule,
    ItemsModule,
  ],
  providers: [
    BotsService,
    BotItemsService,
    BotTransactionsService,
    BotTransactionsEventHost,
  ],
  controllers: [BotsController, BotItemsController, BotTransactionsController],
  exports: [BotsService, BotItemsService, BotTransactionsService],
})
export class BotsModule {
  // forRoot, forCronJob
}
