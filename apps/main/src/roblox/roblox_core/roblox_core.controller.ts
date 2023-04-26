import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";

import { RobloxCoreService } from "./roblox_core.service.js";

@Controller("roblox/core")
export class RobloxCoreController {
  constructor(private readonly robloxCoreService: RobloxCoreService) {}

  @Post("auth/*")
  async auth(@Req() request: FastifyRequest, @Res() reply: FastifyReply) {
    let url = request.url.replace(/^\/roblox\/auth\//, "");
    if (url === request.url) {
      return reply.status(404).send();
    }
    delete request.headers.host;
    delete request.headers.connection;
    delete request.headers["content-length"];
    const response = await this.robloxCoreService.auth({
      url,
      headers: request.headers as Record<string, string>,
      body: request.body as Record<string, any>,
    });
    return reply
      .status(response.status)
      .headers(response.headers)
      .send(response.body);
  }

  @Get(":userId/collectibles")
  async getUserCollectibles(@Param("userId", ParseIntPipe) userId: number) {
    return this.robloxCoreService.getUserCollectibles(userId);
  }
}
