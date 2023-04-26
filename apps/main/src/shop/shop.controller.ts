import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
} from "@nestjs/common";

import { BearerAuth } from "../iam/authentication/decorators/bearer_auth.decorator.js";
import { ActiveUserId } from "../iam/authentication/decorators/active_user_id.decorator.js";
import { RobloxAuth } from "../roblox/decorators/roblox_auth.decorator.js";
import { Roblosecurity } from "../roblox/decorators/roblosecurity.decorator.js";
import { Roblosecret } from "../roblox/decorators/roblosecret.decorator.js";
import { ActiveRobloxUserId } from "../roblox/decorators/active_roblox_user_id.decorator.js";
import { BuyItemsPayloadDto } from "./dto/buy_items_payload.dto.js";
import { ListItemsPayloadDto } from "./dto/list_items_payload.dto.js";
import { UnlistItemsPayloadDto } from "./dto/unlist_items_payload.dto.js";
import { EditItemRatePayloadDto } from "./dto/edit_item_rate_payload.dto.js";
import { ShopService } from "./shop.service.js";

@Controller("shop")
export class ShopController {
  constructor(private readonly shopService: ShopService) {}

  @Get("items")
  @Header("Cache-Control", "public, max-age=1")
  getItems() {
    return this.shopService.getItems();
  }

  @Post("items/buy")
  @HttpCode(HttpStatus.OK)
  @BearerAuth()
  @RobloxAuth()
  buyItems(
    @ActiveUserId() userId: string,
    @ActiveRobloxUserId() robloUserId: number,
    @Roblosecurity() roblosecurity: string,
    @Roblosecret() roblosecret: string | undefined,
    @Body() payload: BuyItemsPayloadDto
  ) {
    return this.shopService.buyItems({
      userId,
      robloUserId,
      roblosecurity,
      roblosecret,
      ...payload,
    });
  }

  @Post("items/list")
  @BearerAuth()
  @RobloxAuth()
  listItems(
    @ActiveUserId() userId: string,
    @ActiveRobloxUserId() robloUserId: number,
    @Roblosecurity() roblosecurity: string,
    @Roblosecret() roblosecret: string | undefined,
    @Body() payload: ListItemsPayloadDto
  ) {
    return this.shopService.listItems({
      userId,
      robloUserId,
      roblosecurity,
      roblosecret,
      ...payload,
    });
  }

  @Post("items/unlist")
  @BearerAuth()
  @HttpCode(HttpStatus.OK)
  unlistItems(
    @ActiveUserId() userId: string,
    @Body() payload: UnlistItemsPayloadDto
  ) {
    return this.shopService.unlistItems({
      userId,
      ...payload,
    });
  }

  @Post("items/:itemId/edit-rate")
  @BearerAuth()
  @HttpCode(HttpStatus.OK)
  editItemRate(
    @ActiveUserId() userId: string,
    @Param("itemId", ParseIntPipe) itemId: number,
    @Body() payload: EditItemRatePayloadDto
  ) {
    return this.shopService.editItemRate({
      userId,
      itemId,
      ...payload,
    });
  }
}
