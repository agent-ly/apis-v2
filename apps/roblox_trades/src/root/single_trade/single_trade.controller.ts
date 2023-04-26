import {
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from "@nestjs/common";

import { SingleTradeService } from "./single_trade.service.js";

@Controller("single-trades")
export class SingleTradeController {
  constructor(private readonly singleTradeService: SingleTradeService) {}

  @Post(":singleTradeId/:userId/solve-challenge")
  @HttpCode(HttpStatus.OK)
  solveSingleTradeChallenge(
    @Param("singleTradeId") singleTradeId: string,
    @Param("userId") userId: string,
    @Query("code") totpCode: string | undefined,
    @Query("secret") totpSecret: string | undefined
  ) {
    return this.singleTradeService.solveChallenge(
      singleTradeId,
      userId,
      totpCode,
      totpSecret
    );
  }
}
