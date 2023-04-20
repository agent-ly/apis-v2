import { Module } from "@nestjs/common";
import { MongoModule } from "nestjs-super-mongodb";

import { COLLECTION_NAME } from "./db_items.constants.js";
import { DbItemsService } from "./db_items.service.js";

@Module({
  imports: [MongoModule.registerCollection(COLLECTION_NAME)],
  providers: [DbItemsService],
  exports: [DbItemsService],
})
export class DbItemsModule {}
