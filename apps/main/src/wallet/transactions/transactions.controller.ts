import { Controller, Get, Param } from "@nestjs/common";

import { TransactionsService } from "./transactions.service.js";

@Controller("wallet/transactions")
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get(":userId")
  findAll(@Param("userId") userId: string) {
    return this.transactionsService.findAllById(userId);
  }

  @Get(":userId/:transactionId")
  findOne(
    @Param("userId") userId: string,
    @Param("transactionId") transactionId: string
  ) {
    return this.transactionsService.findById(userId, transactionId);
  }
}
