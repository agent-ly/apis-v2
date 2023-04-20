import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { MongoModule } from "nestjs-super-mongodb";
import { RedisModule } from "nestjs-super-redis";

import dbConfig from "./config/db.config.js";
import redisConfig from "./config/redis.config.js";
import { WagersModule } from "./wagers/wagers.module.js";
import { WalletModule } from "./wallet/wallet.module.js";
import { BotsModule } from "./bots/bots.module.js";
import { UsersModule } from "./users/users.module.js";
import { IamModule } from "./iam/iam.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [dbConfig, redisConfig],
    }),
    EventEmitterModule.forRoot(),
    MongoModule.forRootAsync(dbConfig.asProvider()),
    RedisModule.forRootAsync(redisConfig.asProvider()),
    WagersModule,
    WalletModule,
    BotsModule,
    UsersModule,
    IamModule,
  ],
})
export class AppModule {}
