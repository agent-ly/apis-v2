import { Body, Controller, Header, Post } from "@nestjs/common";

import {
  AddManyToOneMutliTradePayloadDto,
  AddOneToOneMutliTradePayloadDto,
} from "./queue.dtos.js";
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

  @Post("add-many")
  @Header("Content-Type", "application/json")
  async addManyToOneMultiTrade(
    @Body() payload: AddManyToOneMutliTradePayloadDto
  ): Promise<string> {
    return this.queueService.addManyToOneMultiTrade(payload);
  }
}
