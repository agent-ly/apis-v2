import {
  Catch,
  type ExceptionFilter,
  type ArgumentsHost,
} from "@nestjs/common";

import { RobloxErrorHost } from "./roblox.error-host.js";

@Catch(RobloxErrorHost)
export class RobloxExceptionFilter implements ExceptionFilter {
  async catch(error: RobloxErrorHost, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse();
    const normalized = await error.normalize();
    reply.code(normalized.statusCode).send({ message: normalized.message });
  }
}
