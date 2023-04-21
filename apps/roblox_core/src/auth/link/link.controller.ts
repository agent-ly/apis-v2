import { Body, Controller, Post, UseFilters } from "@nestjs/common";
import { RobloxExceptionFilter } from "roblox-proxy-nestjs";

import { LinkService, type LinkPayload } from "./link.service.js";

@Controller("link")
@UseFilters(RobloxExceptionFilter)
export class LinkController {
  constructor(private readonly linkService: LinkService) {}

  @Post()
  async link(@Body() payload: LinkPayload) {
    return this.linkService.link(payload);
  }
}
