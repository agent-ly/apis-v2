import { Module } from "@nestjs/common";
import { MongoModule } from "nestjs-super-mongodb";

import { COLLECTION_NAME } from "./shop_users.constants.js";
import { ShopUsersService } from "./shop_users.service.js";

@Module({
  imports: [MongoModule.registerCollection(COLLECTION_NAME)],
  providers: [ShopUsersService],
  exports: [ShopUsersService],
})
export class ShopUsersModule {}
