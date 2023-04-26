import { Body, Controller, Post } from "@nestjs/common";

import { BearerAuth } from "../../iam/authentication/decorators/bearer_auth.decorator.js";
import { ActiveUserId } from "../../iam/authentication/decorators/active_user_id.decorator.js";
import { RobloxAuth } from "../../roblox/decorators/roblox_auth.decorator.js";
import { Roblosecurity } from "../../roblox/decorators/roblosecurity.decorator.js";
import { Roblosecret } from "../../roblox/decorators/roblosecret.decorator.js";
import { ActiveRobloxUserId } from "../../roblox/decorators/active_roblox_user_id.decorator.js";
import { BotTransactionsService } from "./bot_transactions.service.js";
import { TransactItemsPayloadDto } from "./dto/transact_items_payload.dto.js";

@Controller("items")
@BearerAuth()
@RobloxAuth()
export class BotTransactionsController {
  constructor(
    private readonly botTransactionsService: BotTransactionsService
  ) {}

  @Post("deposit")
  depositItems(
    @ActiveUserId() userId: string,
    @ActiveRobloxUserId() robloUserId: number,
    @Roblosecurity() roblosecurity: string,
    @Roblosecret() roblosecret: string | undefined,
    @Body() payload: TransactItemsPayloadDto
  ) {
    return this.botTransactionsService.depositItems({
      userId,
      robloUserId,
      roblosecurity,
      roblosecret,
      itemIds: payload.itemIds,
      smallItemId: payload.smallItemId,
    });
  }

  @Post("withdraw")
  withdrawItems(
    @ActiveUserId() userId: string,
    @ActiveRobloxUserId() robloUserId: number,
    @Roblosecurity() roblosecurity: string,
    @Roblosecret() roblosecret: string | undefined,
    @Body() payload: TransactItemsPayloadDto
  ) {
    return this.botTransactionsService.withdrawItems({
      userId,
      robloUserId,
      roblosecurity,
      roblosecret,
      itemIds: payload.itemIds,
      smallItemId: payload.smallItemId,
    });
  }
}
