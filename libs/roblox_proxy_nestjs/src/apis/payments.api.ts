import { Injectable } from "@nestjs/common";

import { RobloxErrorHost } from "../roblox.error-host.js";
import { RobloxClient } from "../roblox.client.js";

type RedeemGiftCardResponse =
  | {
      errors: unknown[];
      redemptionResult: null;
    }
  | {
      errors: null;
      redemptionResult: unknown;
    };

export interface RedeemGiftCardPayload {
  pinCode: string;
  captchaId?: string;
  captchaToken?: string;
}

@Injectable()
export class PaymentsApi {
  constructor(private readonly client: RobloxClient) {}

  async redeemGiftCard(
    roblosecurity: string,
    payload: RedeemGiftCardPayload
  ): Promise<RedeemGiftCardResponse> {
    const url = "https://apis.roblox.com/payments-gateway/v1/gift-card/redeem";
    const init = { method: "POST", roblosecurity, data: payload };
    const response = await this.client.request(url, init);
    const result: RedeemGiftCardResponse = await response.clone().json();
    if (result.errors) {
      throw new RobloxErrorHost(response);
    }
    return result;
  }
}
