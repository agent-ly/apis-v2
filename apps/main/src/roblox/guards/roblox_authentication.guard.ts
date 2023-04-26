import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  ForbiddenException,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";

import { REQUEST_ROBLOX_USER_KEY } from "../roblox.constants.js";
import { RobloxCoreService } from "../roblox_core/roblox_core.service.js";

@Injectable()
export class RobloxAuthenticationGuard implements CanActivate {
  constructor(private readonly robloxCoreService: RobloxCoreService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    console.log("RobloxAuthenticationGuard.canActivate");
    const request = context.switchToHttp().getRequest();
    const roblosecurity = request.headers["roblox-authentication"];
    if (!roblosecurity) {
      throw new ForbiddenException({
        error: "no_roblox_auth",
        message: "You must have an attached Roblox account for this action.",
      });
    }
    const response = await this.robloxCoreService.getAuthenticatedUser(
      roblosecurity
    );
    if (!response.ok) {
      if (response.error === "unauthorized") {
        throw new UnauthorizedException({
          error: "roblox_auth_invalid",
          message:
            "Your Roblox account's authentication is invalid, please re-login.",
        });
      } else if (response.error === "moderated") {
        throw new ForbiddenException({
          error: "roblox_auth_moderated",
          message: "Your Roblox account is moderated.",
        });
      } else {
        throw new BadRequestException({
          error: "roblox_auth_unknown",
          message:
            "An unknown error occurred while authenticating your Roblox account.",
        });
      }
    }
    (request as FastifyRequest & { [REQUEST_ROBLOX_USER_KEY]: unknown })[
      REQUEST_ROBLOX_USER_KEY
    ] = response.data;
    return true;
  }
}
