import { RobloxClient } from "../roblox.client.js";

interface GetInventoryPrivacyResponse {
  inventoryPrivacy:
    | "NoOne"
    | "Friends"
    | "FriendsAndFollowing"
    | "FriendsFollowingAndFollowers"
    | "AllAuthenticatedUsers"
    | "AllUsers";
}

interface GetTradeValueResponse {
  tradeValue: "None" | "Low" | "Medium" | "High";
}

interface GetTradePrivacyResponse {
  tradePrivacy:
    | "Undefined"
    | "Disabled"
    | "NoOne"
    | "Friends"
    | "TopFriends"
    | "Following"
    | "Followers"
    | "All";
}

export class AccountSettingsApi {
  constructor(private readonly client: RobloxClient) {}

  getInventoryPrivacy(
    roblosecurity: string
  ): Promise<GetInventoryPrivacyResponse> {
    const url = "https://accountsettings.roblox.com/v1/inventory-privacy";
    const init = { roblosecurity };
    return this.client.json<GetInventoryPrivacyResponse>(url, init);
  }

  getTradeValue(roblosecurity: string): Promise<GetTradeValueResponse> {
    const url = "https://accountsettings.roblox.com/v1/trade-value";
    const init = { roblosecurity };
    return this.client.json<GetTradeValueResponse>(url, init);
  }

  getTradePrivacy(roblosecurity: string): Promise<GetTradePrivacyResponse> {
    const url = "https://accountsettings.roblox.com/v1/trade-privacy";
    const init = { roblosecurity };
    return this.client.json<GetTradePrivacyResponse>(url, init);
  }
}
