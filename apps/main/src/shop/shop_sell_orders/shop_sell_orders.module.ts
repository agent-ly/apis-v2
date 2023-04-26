import { Module } from "@nestjs/common";
import { MongoModule } from "nestjs-super-mongodb";

import { DbItemsModule } from "../../items/db_items/db_items.module.js";
import { ItemTransactionsModule } from "../../items/item_transactions/item_transactions.module.js";
import { ItemsModule } from "../../items/items.module.js";
import { ShopUsersModule } from "../shop_users/shop_users.module.js";
import { COLLECTION_NAME } from "./shop_sell_orders.constants.js";
import { ShopSellOrdersService } from "./shop_sell_orders.service.js";
import { ShopSellOrdersEventHost } from "./shop_sell_orders.event-host.js";
import { ShopSellOrdersProcessor } from "./shop_sell_orders.processor.js";

@Module({
  imports: [
    MongoModule.registerCollection(COLLECTION_NAME),
    DbItemsModule,
    ItemTransactionsModule,
    ItemsModule,
    ShopUsersModule,
  ],
  providers: [
    ShopSellOrdersService,
    ShopSellOrdersEventHost,
    ShopSellOrdersProcessor,
  ],
  exports: [ShopSellOrdersService],
})
export class ShopSellOrdersModule {}
