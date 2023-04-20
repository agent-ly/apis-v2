import {
  Catch,
  type ExceptionFilter,
  type ArgumentsHost,
} from "@nestjs/common";

import { RobloxApiError } from "../errors/roblox-api.error.js";

@Catch(RobloxApiError)
export class RobloxApiErrorFilter implements ExceptionFilter {
  async catch(error: RobloxApiError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse();
    const normalized = await error.normalize();
    reply.code(normalized.statusCode).send({ message: normalized.message });
  }
}
