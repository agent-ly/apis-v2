import { Injectable } from "@nestjs/common";

import { RobloxClient } from "../roblox.client.js";

export interface GetCreditBalanceResponse {
  balance: number;
  canRedeemCreditForRobux: boolean;
  robuxAmount: number;
}

export interface CheckoutPayload {
  productId: number;
}

export interface CheckoutResponse {
  isSuccess: boolean;
  redirectionUrl: string;
}

export interface CheckoutSuccessPayload {
  saleId: string;
}

export interface CheckoutSuccessResponse {}

@Injectable()
export class BillingApi {
  public static readonly CONVERT_TO_ROBUX_THRESHOLD = 4.99;

  constructor(private readonly client: RobloxClient) {}

  getCreditBalance(roblosecurity: string): Promise<GetCreditBalanceResponse> {
    const url = "https://billing.roblox.com/v1/credit";
    const init = { roblosecurity };
    return this.client.json(url, init);
  }

  redeemCredit(roblosecurity: string): Promise<boolean> {
    const url = "https://billing.roblox.com/v1/credit/redeem-robux";
    const init = { method: "POST", roblosecurity };
    return this.client.json(url, init);
  }

  checkout(
    roblosecurity: string,
    payload: CheckoutPayload
  ): Promise<CheckoutResponse> {
    const url = "https://billing.roblox.com/v1/payments/credit/checkout";
    const init = { method: "POST", roblosecurity, data: payload };
    return this.client.json(url, init);
  }

  checkoutSuccess(
    roblosecurity: string,
    payload: CheckoutSuccessPayload
  ): Promise<CheckoutSuccessResponse> {
    const url = "https://billing.roblox.com/v1/payments/checkout/success";
    const init = { method: "POST", roblosecurity, data: payload };
    return this.client.json(url, init);
  }
}

//https://billing.roblox.com/v1/payments/credit/metadata?ap=475 - {"viewModel":{"selectedProduct":{"ProductId":475,"Name":"440 Robux","DurationTitle":"","CurrencyCode":"USD","Price":4.9900,"IsCurrentPremiumFeature":false,"PremiumFeatureId":0,"IsDisabled":false,"Expiration":null,"IsRenewable":false,"RenewOrExpireText":null,"ImageFile":"RB_L","PriceText":"$4.99","GiftcardShoppingCartProductId":0},"availableCredit":5.01,"totalDue":4.9900,"balance":0.0200},"redirectionUrl":null}
//https://billing.roblox.com/v1/payments/checkout/success - {"redirectUrl":null,"boughtProducts":[{"ProductId":475,"Name":"440 Robux","DurationTitle":"","CurrencyCode":"USD","Price":4.9900,"IsCurrentPremiumFeature":false,"PremiumFeatureId":0,"IsDisabled":false,"Expiration":null,"IsRenewable":false,"RenewOrExpireText":null,"ImageFile":"RB_L","PriceText":"$4.99","GiftcardShoppingCartProductId":0}],"saleId":1804197739,"listPriceTotal":4.9900,"isGiftCard":false,"isRedeemedGiftCard":false,"giftCardRedemptionCode":null,"giftCardDownLoadUrl":null,"isCakePixelEmbeddedOnPaymentSuccessPages":false,"cakeTrackingSource":"https://roblox.com?a=1&t=3680271&p=4.9900","robloxSupportUrl":"https://www.roblox.com/support","currencyType":"United States dollar"}
