import { Injectable } from "@nestjs/common";

import { RobloxApiError } from "../errors/roblox-api.error.js";
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
    // We peek at the body if it has any errors
    const result: RedeemGiftCardResponse = await response.clone().json();
    if (result.errors) {
      throw new RobloxApiError(response);
    }
    return result;
  }
}

/*export const gameCardMessageMapping = {
  0: 'Response.UnexpectedError',
  10: 'Response.AlreadyRedeemedCodeFullError',
  20: 'Response.InvalidCode',
  30: 'Response.NetworkError',
  70: 'Response.RedemptionDisabled',
  80: 'Response.NeedCaptcha'
};*/
//https://roblox-api.arkoselabs.com/fc/gt2/public_key/1B154715-ACB4-2706-19ED-0DC7E3F7D855
//{"errors":[{"code":80,"message":"","userFacingMessage":"","fieldData":"{\"dxBlob\":\"F0nu36oooit0CvQM.DXqakA+5vEnFPPniEQeoh0X8bqp8XkSn+XRram5AmTTfBxienDTlJgBzJQ1gj6OE0quRjR9IBjZ5jEqdouxmADRebQZH8BRe4qQ83FSbXGc/0e8n/vvMFUPcVO0LHBj99V03dJLy0TdbVxHJvWaX0hvqWFK7C966M0Bp1jvXdxzJ2uksfsqDyeJUiO/Bc3Cq94amPXRHsnmqsI+e7/5jfno5noV48VwKu2lGIpERCJ3YzG5uP3hCpXO0HzmjxrhIotmA5qBWP7qME3DPDct6Xj41EC4d4U+86oNBIqJ1xf+QZJH3Ef3RNCiVIOLIKy1lmBScLcuV1dhQmWu1VVKHLuZhQ/K+UcTdFpqRz5ksZtbpTw2P5eGmx0sB0oabLHXtPGD4/kCKHnizZ8SGp/UOgvUVPe49Gnlk1FMjjmHvIWzGNQVFlTwSFlMRvvxINAC3URuSpWQdAKYxOkcdf7dJbbHEHcFC7VA3myIxzvNtHu/VJlOBB8vw13oITVIC5/3iO8FvyuMItt+zfcjRK9i1DIIe7Nef74HtcFDOdMeS6zbTQpYRChe6zFO0pZSlIgCl7k5uTnyK70L/imse8ybQ\",\"unifiedCaptchaId\":\"s6CMGZT8jz7P6CL4nBPyxR\"}"}],"redemptionResult":null}
//{"errors":[{"code":20,"message":null,"userFacingMessage":null,"fieldData":""}],"redemptionResult":null}
//{"errors":null,"redemptionResult":{"balance":"$10.00","creatorName":"Roblox","error":"0","itemId":12566121667,"itemName":"Joker's Wild Cardback","itemType":"Asset","itemTypeDisplayName":"Back","redeemedCredit":10.0,"successMsg":"You have successfully redeemed your gift card!","successSubText":"Successfully added 10.0 to your credit balance"}}
