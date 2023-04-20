import { Body, Controller, Header, Post } from "@nestjs/common";

import { AddOneToOneMutliTradePayloadDto } from "./queue.dtos.js";
import { QueueService } from "./queue.service.js";

@Controller("queue")
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Post("add")
  @Header("Content-Type", "application/json")
  async addOneToOneMultiTrade(
    @Body() payload: AddOneToOneMutliTradePayloadDto
  ): Promise<string> {
    return this.queueService.addOneToOneMultiTrade(payload);
  }
}
