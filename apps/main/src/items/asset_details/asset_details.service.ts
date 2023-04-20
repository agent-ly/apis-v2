import { Injectable } from "@nestjs/common";

import { RolimonsService } from "../../roblox/rolimons/rolimons.service.js";
import { AssetDetailsStorage } from "./asset_details.storage.js";

@Injectable()
export class AssetDataService {
  constructor(
    private readonly rolimonsService: RolimonsService,
    private readonly assetDetailsStorage: AssetDetailsStorage
  ) {}

  async update() {
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
        let isProjected = !!details.metadata.manualProjected;
        if (!isProjected) {
          // Check if rolimons has marked the item as projected
          const isRolimonsProjected = details.metadata.rolimonsProjected;
          isProjected = !!isRolimonsProjected;
          const isMarkedAsProjected = data.items[assetId][7] === 1;
          if (!isRolimonsProjected && isMarkedAsProjected) {
            details.metadata.rolimonsProjected = true;
            isProjected = true;
          } else if (isRolimonsProjected && !isMarkedAsProjected) {
            details.metadata.rolimonsProjected = false;
            isProjected = false;
          }
        }
        if (!isProjected) {
          // Check if the item meets the threshold for to be automatically projected
          const isAutoProjected = details.metadata.autoProjected;
          isProjected = !!isAutoProjected;
          const multiplier = oldValue <= 2.5e3 ? 1.15 : 1.25;
          const thresholdValue = oldValue * multiplier;
          const isValueProjected = newValue >= thresholdValue;
          if (!isAutoProjected && isValueProjected) {
            details.metadata.autoProjected = true;
            isProjected = true;
          } else if (isAutoProjected && !isValueProjected) {
            details.metadata.autoProjected = false;
            isProjected = false;
          }
          ignoreNewValue = isProjected;
        }
        details.metadata.projected = isProjected;
      }
      if (!ignoreNewValue) {
        details.value = newValue;
      }
      newAssetDetails.set(assetId, details);
    }
    await this.assetDetailsStorage.update(newAssetDetails);
  }
}
