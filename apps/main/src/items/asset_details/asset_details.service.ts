import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";

import { RolimonsService } from "../../roblox/rolimons/rolimons.service.js";
import { ASSET_DETAILS_UPDATED_EVENT } from "./asset_details.constants.js";
import { AssetDetailsStorage } from "./asset_details.storage.js";

@Injectable()
export class AssetDetailsService implements OnModuleInit {
  private static readonly UPDATE_INTERVAL = 1e3 * 60 * 5;

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly rolimonsService: RolimonsService,
    private readonly assetDetailsStorage: AssetDetailsStorage
  ) {}

  onModuleInit(): void {
    this.update();
  }

  async update(): Promise<void> {
    const data = await this.rolimonsService.getItemDetails();
    if (data === null) {
      return;
    }
    const oldAssetDetails = await this.assetDetailsStorage.selectAll();
    const newAssetDetails: typeof oldAssetDetails = new Map();
    for (const strAssetId in data.items) {
      const assetId = parseInt(strAssetId, 10);
      const hasValue = data.items[assetId][3] !== -1;
      const newValue = hasValue
        ? data.items[assetId][3]
        : data.items[assetId][2];
      const hasDetails = oldAssetDetails.has(assetId);
      const details = hasDetails
        ? oldAssetDetails.get(assetId)!
        : { value: newValue, metadata: {} };
      const oldValue = details.value;
      if (hasDetails && oldValue === newValue) {
        continue;
      }
      let ignoreNewValue = false;
      if (!hasValue) {
        const isManualProjected = details.metadata.manualProjected ?? false;
        let isProjected = isManualProjected;
        if (!isProjected) {
          // Check if rolimons has marked the item as projected
          const isRolimonsProjected =
            details.metadata.rolimonsProjected ?? false;
          isProjected = isRolimonsProjected;
          const isMarkedAsProjected = data.items[assetId][7] === 1;
          if (!isRolimonsProjected && isMarkedAsProjected) {
            details.metadata.rolimonsProjected = true;
            isProjected = true;
          } else if (isRolimonsProjected && !isMarkedAsProjected) {
            details.metadata.rolimonsProjected = false;
            isProjected = false;
          }
          if (!isProjected) {
            // Check if the item meets the threshold for to be automatically projected
            // As well as if it has been lpped
            const isAutoProjected = details.metadata.autoProjected ?? false;
            isProjected = isAutoProjected;
            const maxMultiplier = oldValue <= 2.5e3 ? 1.15 : 1.25;
            const maxValue = oldValue * maxMultiplier;
            const isValueProjected = newValue >= maxValue;
            if (!isAutoProjected && isValueProjected) {
              details.metadata.autoProjected = true;
              isProjected = true;
            } else if (isAutoProjected && !isValueProjected) {
              details.metadata.autoProjected = false;
              isProjected = false;
            }
            const minMultiplier = 0.9;
            const minValue = oldValue * minMultiplier;
            const isValueLpped = newValue <= minValue;
            ignoreNewValue = isProjected || isValueLpped;
          }
        }
        details.metadata.projected = isProjected;
      }
      if (!ignoreNewValue) {
        details.value = newValue;
      }
      newAssetDetails.set(assetId, details);
    }
    await this.assetDetailsStorage.update(newAssetDetails);
    this.eventEmitter.emit(ASSET_DETAILS_UPDATED_EVENT);
    setTimeout(() => this.update(), AssetDetailsService.UPDATE_INTERVAL);
  }
}
