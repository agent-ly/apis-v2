import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { MongoModule } from "nestjs-super-mongodb";
import { RedisModule } from "nestjs-super-redis";

import dbConfig from "./config/db.config.js";
import redisConfig from "./config/redis.config.js";
import { ItemsModule } from "./items/items.module.js";
import { WalletModule } from "./wallet/wallet.module.js";
import { BotsModule } from "./bots/bots.module.js";
import { WagersModule } from "./wagers/wagers.module.js";
import { UsersModule } from "./users/users.module.js";
import { IamModule } from "./iam/iam.module.js";
import { ShopModule } from "./shop/shop.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [dbConfig, redisConfig],
    }),
    EventEmitterModule.forRoot(),
    MongoModule.forRootAsync(dbConfig.asProvider()),
    RedisModule.forRootAsync(redisConfig.asProvider()),
    ItemsModule,
    WalletModule,
    BotsModule,
    WagersModule,
    UsersModule,
    IamModule,
    ShopModule,
  ],
})
export class AppModule {}
