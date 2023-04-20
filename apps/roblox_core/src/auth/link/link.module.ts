import { Module } from "@nestjs/common";
import { AuthTicketApi } from "roblox-proxy-nestjs/apis/auth_ticket.api";
import { UsersApi } from "roblox-proxy-nestjs/apis/users.api";

import { LocatorService } from "./locator.service.js";
import { LinkService } from "./link.service.js";
import { LinkController } from "./link.controller.js";

@Module({
  providers: [AuthTicketApi, UsersApi, LocatorService, LinkService],
  controllers: [LinkController],
})
export class LinkModule {}
