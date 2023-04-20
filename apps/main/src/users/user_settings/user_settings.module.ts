import { Module } from "@nestjs/common";
import { MongoModule } from "nestjs-super-mongodb";

import { COLLECTION_NAME } from "./user_settings.constants.js";
import { UserSettingsService } from "./user_settings.service.js";

@Module({
  imports: [MongoModule.registerCollection(COLLECTION_NAME)],
  providers: [UserSettingsService],
  exports: [UserSettingsService],
})
export class UserSettingsModule {}
