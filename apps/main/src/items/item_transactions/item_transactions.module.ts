import { Module } from "@nestjs/common";
import { MongoModule } from "nestjs-super-mongodb";

import { CryptModule } from "../../crypt/crypt.module.js";
import { RobloxModule } from "../../roblox/roblox.module.js";
import { COLLECTION_NAME } from "./item_transactions.constants.js";
import { ItemTransactionsService } from "./item_transactions.service.js";

@Module({
  imports: [
    MongoModule.registerCollection(COLLECTION_NAME),
    CryptModule,
    RobloxModule,
  ],
  providers: [ItemTransactionsService],
  exports: [ItemTransactionsService],
})
export class ItemTransactionsModule {}
