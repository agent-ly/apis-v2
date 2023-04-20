import { Module } from "@nestjs/common";
import { MongoModule } from "nestjs-super-mongodb";

import { COLLECTION_NAME } from "./users.constants.js";
import { UsersService } from "./users.service.js";

@Module({
  imports: [MongoModule.registerCollection(COLLECTION_NAME)],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
