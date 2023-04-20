import { Module } from "@nestjs/common";

import { AssetDataService } from "./asset_details/asset_details.service.js";
import { AssetDataStorage } from "./asset_details/asset_details.storage.js";
import { ItemReservesStorage } from "./item_reserves/item_reserves.storage.js";
import { ItemsService } from "./items.service.js";

@Module({
  providers: [
    AssetDataService,
    AssetDataStorage,
    ItemReservesStorage,
    ItemsService,
  ],
  exports: [ItemsService, ItemReservesStorage],
})
export class ItemsModule {}
