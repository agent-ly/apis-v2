import { Module } from "@nestjs/common";
import { AccountSettingsApi } from "roblox-proxy-nestjs/apis/account_settings.api";
import { InventoryApi } from "roblox-proxy-nestjs/apis/inventory.api";
import { PremiumFeaturesApi } from "roblox-proxy-nestjs/apis/premium_features.api";
import { UsersApi } from "roblox-proxy-nestjs/apis/users.api";

import { UserController } from "./user.controller.js";

@Module({
  providers: [AccountSettingsApi, InventoryApi, PremiumFeaturesApi, UsersApi],
  controllers: [UserController],
})
export class UserModule {}
