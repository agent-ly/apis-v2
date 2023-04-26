import { Body, Controller, Get, Param, Post } from "@nestjs/common";

import { BearerAuth } from "../iam/authentication/decorators/bearer_auth.decorator.js";
import { AdminOnly } from "../iam/authorization/decorators/admin_only.decorator.js";
import { CreateBotPayloadDto } from "./dto/create_bot_payload.dto.js";
import { BotsService } from "./bots.service.js";

@Controller("bots")
@BearerAuth()
@AdminOnly()
export class BotsController {
  constructor(private readonly botsService: BotsService) {}

  @Get()
  findAllBots() {
    return this.botsService.findAll();
  }

  @Post("create")
  createBot(@Body() payload: CreateBotPayloadDto) {
    return this.botsService.create(payload);
  }

  @Post(":botId/delete")
  deleteBot(@Param() botId: number) {
    return this.botsService.delete(botId);
  }

  @Post(":botId/toggle/:enabled")
  toggleBot(@Param() botId: number, @Param() enabled: boolean) {
    return this.botsService.toggle(botId, enabled);
  }
}
