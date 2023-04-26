import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from "@nestjs/common";

import { MultiTradeService } from "./multi_trade.service.js";

@Controller("multi-trades")
export class MultiTradeController {
  constructor(private readonly multiTradeService: MultiTradeService) {}

  @Get("stats")
  async getMultiTradeStats(
    @Query("startDate") startDateStr: string,
    @Query("endDate") endDateStr: string
  ) {
    const startDate = new Date(startDateStr),
      endDate = new Date(endDateStr);
    return this.multiTradeService.stats(startDate, endDate);
  }

  @Get("unacknowledged")
  async findUnacknowledgedMultiTrades() {
    return this.multiTradeService.findUnacknowledgedMultiTrades();
  }

  @Get(":multiTradeId")
  async findMultiTradeById(@Param("multiTradeId") multiTradeId: string) {
    return this.multiTradeService.findByIdOrThrow(multiTradeId);
  }

  @Post(":multiTradeId/acknowledge")
  @HttpCode(HttpStatus.OK)
  async acknowledgeMultiTrade(@Param("multiTradeId") multiTradeId: string) {
    return this.multiTradeService.acknowledge(multiTradeId);
  }
}
