import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from "@nestjs/common";

import { MultiTradeStatus } from "./multi_trade.entity.js";
import { MultiTradeService } from "./multi_trade.service.js";

@Controller("multi-trades")
export class MultiTradeController {
  constructor(private readonly multiTradeService: MultiTradeService) {}

  @Get("stats")
  async getMultiTradeStats(
    @Query("startDate") startDate: Date,
    @Query("endDate") endDate: Date
  ) {
    return this.multiTradeService.stats(startDate, endDate);
  }

  @Get("status/:status")
  async findMultiTradesByStatus(@Param("status") status: MultiTradeStatus) {
    return this.multiTradeService.findByStatus(status);
  }

  @Get(":multiTradeId")
  async findMultiTradeById(@Param("multiTradeId") multiTradeId: string) {
    return this.multiTradeService.findByIdOrThrow(multiTradeId);
  }

  @HttpCode(HttpStatus.OK)
  @Post(":multiTradeId/acknowledge")
  async acknowledgeMultiTrade(@Param("multiTradeId") multiTradeId: string) {
    return this.multiTradeService.acknowledge(multiTradeId);
  }
}
