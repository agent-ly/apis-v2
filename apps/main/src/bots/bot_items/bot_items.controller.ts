import { Controller, Get } from "@nestjs/common";

import { BearerAuth } from "../../iam/authentication/decorators/bearer_auth.decorator.js";
import { ActiveUserId } from "../../iam/authentication/decorators/active_user_id.decorator.js";
import { BotItemsService } from "./bot_items.service.js";

@Controller("items")
@BearerAuth()
export class BotItemsController {
  constructor(private readonly botItemsService: BotItemsService) {}

  @Get()
  getItems(@ActiveUserId() userId: string) {
    return this.botItemsService.getItems(userId);
  }
}
