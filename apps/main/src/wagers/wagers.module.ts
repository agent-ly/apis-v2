import { Module } from "@nestjs/common";
import { MongoModule } from "nestjs-super-mongodb";

import { BotsModule } from "../bots/bots.module.js";
import { COLLECTION_NAME } from "./wagers.constants.js";
import { WagersService } from "./wagers.service.js";

@Module({
  imports: [MongoModule.registerCollection(COLLECTION_NAME), BotsModule],
  providers: [WagersService],
  exports: [WagersService],
})
export class WagersModule {}
