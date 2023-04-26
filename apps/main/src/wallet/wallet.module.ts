import { Module } from "@nestjs/common";
import { MongoModule } from "nestjs-super-mongodb";

import { TransactionsModule } from "./transactions/transactions.module.js";
import { COLLECTION_NAME } from "./wallet.constants.js";
import { WalletService } from "./wallet.service.js";
import { WalletController } from "./wallet.controller.js";

@Module({
  imports: [
    MongoModule.registerCollection(COLLECTION_NAME),
    TransactionsModule,
  ],
  providers: [WalletService],
  controllers: [WalletController],
  exports: [TransactionsModule, WalletService],
})
export class WalletModule {}
