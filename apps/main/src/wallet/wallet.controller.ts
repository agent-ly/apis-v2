import { Body, Controller, Get, Post, UseFilters } from "@nestjs/common";

import { ActiveUserId } from "../iam/authentication/decorators/active_user_id.decorator.js";
import { WithdrawPayloadDto } from "./dto/withdraw_payload.dto.js";
import { WalletService } from "./wallet.service.js";
import { WalletExceptionFilter } from "./wallet.exception-filter.js";

@Controller("wallet")
@UseFilters(WalletExceptionFilter)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  getWallet(@ActiveUserId() userId: string) {
    return this.walletService.findById(userId);
  }

  @Post("withdraw")
  withdraw(
    @ActiveUserId() userId: string,
    @Body() payload: WithdrawPayloadDto
  ) {
    return this.walletService.withdraw(userId, payload);
  }
}
