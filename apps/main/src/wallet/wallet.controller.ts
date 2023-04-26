import { Body, Controller, Get, Post, UseFilters } from "@nestjs/common";

import { Auth } from "../iam/authentication/decorators/auth.decorator.js";
import { AuthStrategy } from "../iam/authentication/enums/auth_strategy.enum.js";
import { ActiveUserId } from "../iam/authentication/decorators/active_user_id.decorator.js";
import { WalletExceptionFilter } from "./wallet.exception-filter.js";
import { WithdrawPayloadDto } from "./dto/withdraw_payload.dto.js";
import { WalletService } from "./wallet.service.js";

@Controller("wallet")
@Auth(AuthStrategy.Bearer)
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
