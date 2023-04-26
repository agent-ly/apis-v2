import { Module } from "@nestjs/common";

import { RobloxModule } from "../roblox/roblox.module.js";
import { RolimonsModule } from "../roblox/rolimons/rolimons.module.js";
import { AssetDetailsStorage } from "./asset_details/asset_details.storage.js";
import { AssetDetailsService } from "./asset_details/asset_details.service.js";
import { ItemReservesStorage } from "./item_reserves/item_reserves.storage.js";
import { ItemsService } from "./items.service.js";

@Module({
  imports: [RobloxModule, RolimonsModule],
  providers: [
    AssetDetailsStorage,
    AssetDetailsService,
    ItemReservesStorage,
    ItemsService,
  ],
  exports: [ItemsService, ItemReservesStorage],
})
export class ItemsModule {
  // forRoot, forCronJob
}
