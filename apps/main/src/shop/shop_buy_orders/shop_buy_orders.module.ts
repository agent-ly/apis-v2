import { Module } from "@nestjs/common";
import { MongoModule } from "nestjs-super-mongodb";

import { DbItemsModule } from "../../items/db_items/db_items.module.js";
import { WalletModule } from "../../wallet/wallet.module.js";
import { COLLECTION_NAME } from "./shop_buy_orders.constants.js";
import { ShopBuyOrdersService } from "./shop_buy_orders.service.js";
import { ShopBuyOrdersEventHost } from "./shop_buy_orders.event-host.js";

@Module({
  imports: [
    MongoModule.registerCollection(COLLECTION_NAME),
    DbItemsModule,
    WalletModule,
  ],
  providers: [ShopBuyOrdersService, ShopBuyOrdersEventHost],
  exports: [ShopBuyOrdersService],
})
export class ShopBuyOrdersModule {}
