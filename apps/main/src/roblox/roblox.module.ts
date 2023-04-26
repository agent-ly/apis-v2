import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import robloxConfig from "./roblox.config.js";
import { RobloxCoreService } from "./roblox_core/roblox_core.service.js";
import { RobloxCoreController } from "./roblox_core/roblox_core.controller.js";
import { RobloxTradesService } from "./roblox_trades/roblox_trades.service.js";
import { RobloxAuthenticationGuard } from "./guards/roblox_authentication.guard.js";

@Module({
  imports: [ConfigModule.forFeature(robloxConfig)],
  providers: [
    RobloxCoreService,
    RobloxTradesService,
    RobloxAuthenticationGuard,
  ],
  controllers: [RobloxCoreController],
  exports: [RobloxCoreService, RobloxTradesService],
})
export class RobloxModule {}
