import { Module } from "@nestjs/common";
import { RedisUtilModule } from "nestjs-super-redis/util";

import { RobloxModule } from "../roblox/roblox.module.js";
import { WalletModule } from "../wallet/wallet.module.js";
import { DbItemsModule } from "../items/db_items/db_items.module.js";
import { ItemsModule } from "../items/items.module.js";
import { ShopUsersModule } from "./shop_users/shop_users.module.js";
import { ShopSellOrdersModule } from "./shop_sell_orders/shop_sell_orders.module.js";
import { ShopBuyOrdersModule } from "./shop_buy_orders/shop_buy_orders.module.js";
import { ShopService } from "./shop.service.js";
import { ShopController } from "./shop.controller.js";

@Module({
  imports: [
    RedisUtilModule.register(),
    RobloxModule,
    DbItemsModule,
    ItemsModule,
    WalletModule,
    ShopUsersModule,
    ShopSellOrdersModule,
    ShopBuyOrdersModule,
  ],
  providers: [ShopService],
  controllers: [ShopController],
})
export class ShopModule {}
