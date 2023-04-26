import { Body, Controller, Post } from "@nestjs/common";

import {
  AutoService,
  type RedeemAndConvertGiftCardPayload,
} from "./auto.service.js";

@Controller("auto")
export class AutoController {
  constructor(private readonly autoService: AutoService) {}

  @Post("redeem-and-convert-gift-card")
  async redeemAndConvertGiftCard(
    @Body() payload: RedeemAndConvertGiftCardPayload
  ) {
    return this.autoService.redeemAndConvertGiftCard(payload);
  }
}
