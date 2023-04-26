import { Body, Controller, Header, Post } from "@nestjs/common";

import {
  AddManyToOneMutliTradePayloadDto,
  AddOneToOneMutliTradePayloadDto,
} from "./root.dtos.js";
import { RootService } from "./root.service.js";

@Controller()
export class RootController {
  constructor(private readonly rootService: RootService) {}

  @Post("add-one-to-one-multi-trade")
  @Header("Content-Type", "application/json")
  async addOneToOneMultiTrade(
    @Body() payload: AddOneToOneMutliTradePayloadDto
  ): Promise<string> {
    return this.rootService.addOneToOneMultiTrade(payload);
  }

  @Post("add-many-to-one-multi-trade")
  @Header("Content-Type", "application/json")
  async addManyToOneMultiTrade(
    @Body() payload: AddManyToOneMutliTradePayloadDto
  ): Promise<string> {
    return this.rootService.addManyToOneMultiTrade(payload);
  }
}
