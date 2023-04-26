import { Injectable } from "@nestjs/common";

import { RobloxClient } from "../roblox.client.js";

@Injectable()
export class PremiumFeaturesApi {
  constructor(private readonly client: RobloxClient) {}

  isPremium(roblosecurity: string, userId: number): Promise<boolean> {
    const url = `https://premiumfeatures.roblox.com/v1/users/${userId}/validate-membership`;
    const init = { roblosecurity };
    return this.client.json(url, init);
  }
}
