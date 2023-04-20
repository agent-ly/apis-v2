import { Controller, Get, UseFilters, Param, Query } from "@nestjs/common";
import { RobloxApiErrorFilter } from "roblox-proxy-nestjs";
import { AccountSettingsApi } from "roblox-proxy-nestjs/apis/account_settings.api";
import { InventoryApi } from "roblox-proxy-nestjs/apis/inventory.api";
import { PremiumFeaturesApi } from "roblox-proxy-nestjs/apis/premium_features.api";
import { UsersApi } from "roblox-proxy-nestjs/apis/users.api";

import { Roblosecurity } from "../../common/decorators.js";

@Controller("user")
@UseFilters(RobloxApiErrorFilter)
export class UserController {
  constructor(
    private readonly accountSettingsApi: AccountSettingsApi,
    private readonly inventoryApi: InventoryApi,
    private readonly premiumApi: PremiumFeaturesApi,
    private readonly usersApi: UsersApi
  ) {}

  @Get(":userId")
  async getUser(@Param("userId") userId: number) {
    return this.usersApi.getUser(userId);
  }

  @Get(":userId/collectibles")
  async getCollectibles(
    @Roblosecurity({ optional: true }) roblosecurity: string,
    @Param("userId") userId: number,
    @Query("cursor") cursor?: string
  ) {
    return this.inventoryApi.getCollectibleUserAssets(
      userId,
      cursor,
      roblosecurity
    );
  }

  @Get("authenticated")
  async getAuthenticatedUser(@Roblosecurity() roblosecurity: string) {
    return this.usersApi.getAuthenticatedUser(roblosecurity);
  }

  @Get("authenticated/can-trade")
  async canTrade(@Roblosecurity() roblosecurity: string) {
    const user = await this.usersApi.getAuthenticatedUser(roblosecurity);
    const isPremium = await this.premiumApi.isPremium(roblosecurity, user.id);
    if (!isPremium) {
      return {
        ok: false,
        error: "no_premium",
        message: "No premium membership.",
      };
    }
    const inventoryPrivacy = await this.accountSettingsApi.getInventoryPrivacy(
      roblosecurity
    );
    if (inventoryPrivacy.inventoryPrivacy !== "AllUsers") {
      return {
        ok: false,
        error: "invalid_inventory_privacy",
        message: "Inventory must be public.",
      };
    }
    const tradeValue = await this.accountSettingsApi.getTradeValue(
      roblosecurity
    );
    if (tradeValue.tradeValue !== "None") {
      return {
        ok: false,
        error: "invalid_trade_value",
        message: 'Trade value must be set to "None".',
      };
    }
    const tradePrivacy = await this.accountSettingsApi.getTradePrivacy(
      roblosecurity
    );
    if (tradePrivacy.tradePrivacy !== "All") {
      return {
        ok: false,
        error: "invalid_trade_privacy",
        message: 'Trade privacy must be set to "All".',
      };
    }
    return { ok: true };
  }
}
