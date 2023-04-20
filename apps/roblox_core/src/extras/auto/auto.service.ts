import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { Result } from "errd/result";
import { BillingApi } from "roblox-proxy-nestjs/apis/billing.api";
import { PaymentsApi } from "roblox-proxy-nestjs/apis/payments.api";

import { withError } from "../../common/utils.js";

export interface RedeemAndConvertGiftCardPayload {
  roblosecurity: string;
  giftCardPinCode: string;
  captchaId?: string;
  captchaToken?: string;
}

@Injectable()
export class AutoService {
  private readonly logger = new Logger(AutoService.name);

  constructor(
    private readonly billingApi: BillingApi,
    private readonly paymentsApi: PaymentsApi
  ) {}

  async redeemAndConvertGiftCard(payload: RedeemAndConvertGiftCardPayload) {
    const miniPinCode = payload.giftCardPinCode.slice(-8);
    this.logger.debug(`Redeeming gift card ${miniPinCode}...`);
    const result = await Result.fromAsync(() =>
      this.paymentsApi.redeemGiftCard(payload.roblosecurity, {
        pinCode: payload.giftCardPinCode,
      })
    );
    if (result.isErr()) {
      return withError(result, (error) => {
        if (error.statusCode === 403 && error.errorCode === 80) {
          const { dxBlob: captchaBlob, unifiedCaptchaId: captchaId } =
            JSON.parse(error.fieldData as string) as {
              dxBlob: string;
              unifiedCaptchaId: string;
            };
          return {
            ok: false,
            error: "CaptchaRequired",
            captchaBlob,
            captchaId,
          };
        }
      });
    }
    this.logger.debug("Gift card redeemed, converting to R$...");
    const { robuxAmount } = await this.billingApi.getCreditBalance(
      payload.roblosecurity
    );
    const redeemed = await this.billingApi.redeemCredit(payload.roblosecurity);
    if (!redeemed) {
      throw new BadRequestException("Failed to redeem credit.");
    }
    this.logger.debug(`Converted gift card into R$${robuxAmount}.`);
  }
}
