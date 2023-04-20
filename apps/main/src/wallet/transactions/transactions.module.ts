import { Module } from "@nestjs/common";
import { MongoModule } from "nestjs-super-mongodb";

import { COLLECTION_NAME } from "./transactions.constants.js";
import { TransactionsService } from "./transactions.service.js";
import { TransactionsController } from "./transactions.controller.js";

@Module({
  imports: [MongoModule.registerCollection(COLLECTION_NAME)],
  providers: [TransactionsService],
  controllers: [TransactionsController],
  exports: [TransactionsService],
})
export class TransactionsModule {}
