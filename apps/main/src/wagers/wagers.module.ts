import { Module } from "@nestjs/common";
import { MongoModule } from "nestjs-super-mongodb";

import { WalletModule } from "../wallet/wallet.module.js";
import { BotsModule } from "../bots/bots.module.js";
import { COLLECTION_NAME } from "./wagers.constants.js";
import { WagersService } from "./wagers.service.js";

@Module({
  imports: [
    MongoModule.registerCollection(COLLECTION_NAME),
    WalletModule,
    BotsModule,
  ],
  providers: [WagersService],
  exports: [WagersService],
})
export class WagersModule {}
