import { Controller, Get, UseFilters } from "@nestjs/common";
import { RobloxErrorHost, RobloxExceptionFilter } from "roblox-proxy-nestjs";
import { AccountSettingsApi } from "roblox-proxy-nestjs/apis/account_settings.api";
import { PremiumFeaturesApi } from "roblox-proxy-nestjs/apis/premium_features.api";
import { UsersApi } from "roblox-proxy-nestjs/apis/users.api";

import { Roblosecurity } from "../../common/decorators.js";

@Controller("authenticated-user")
@UseFilters(RobloxExceptionFilter)
export class AuthenticatedUserController {
  constructor(
    private readonly accountSettingsApi: AccountSettingsApi,
    private readonly premiumApi: PremiumFeaturesApi,
    private readonly usersApi: UsersApi
  ) {}

  @Get()
  getUser(@Roblosecurity() roblosecurity: string) {
    return this.usersApi.getAuthenticatedUser(roblosecurity);
  }

  @Get("can-trade")
  async canTrade(@Roblosecurity() roblosecurity: string) {
    try {
      const user = await this.usersApi.getAuthenticatedUser(roblosecurity);
      const isPremium = await this.premiumApi.isPremium(roblosecurity, user.id);
      if (!isPremium) {
        return {
          ok: false,
          error: "no_premium",
          message: "No premium membership.",
        };
      }
      const inventoryPrivacy =
        await this.accountSettingsApi.getInventoryPrivacy(roblosecurity);
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
    } catch (exception) {
      let status: number | undefined;
      if (exception instanceof RobloxErrorHost) {
        status = exception.getStatus();
      }
      const [error, message] =
        status === 401
          ? ["unauthorized", "Could not authenticate roblox user."]
          : status === 403
          ? ["moderated", "Roblox user is moderated."]
          : ["unknown", "An unknown error occurred."];
      return {
        ok: false,
        error,
        message,
      };
    }
    return { ok: true };
  }
}
