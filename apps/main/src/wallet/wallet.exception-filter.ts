import { type ArgumentsHost, BadRequestException, Catch } from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";

import { AmountZeroError } from "./errors/amount_zero.error.js";
import { AmountInvalidError } from "./errors/amount_invalid.error.js";
import { BalanceInsufficientError } from "./errors/balance_insufficient.error.js";
import { BalanceLockedError } from "./errors/balance_locked.error.js";
import { AmlError } from "./errors/aml.error.js";
import { KycError } from "./errors/kyc.error.js";

@Catch(
  AmountZeroError,
  AmountInvalidError,
  BalanceInsufficientError,
  BalanceLockedError,
  AmlError,
  KycError
)
export class WalletExceptionFilter extends BaseExceptionFilter {
  catch({ message }: Error, host: ArgumentsHost) {
    const exception = new BadRequestException(message);
    super.catch(exception, host);
  }
}
