import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

export const RobloxHeader = createParamDecorator(
  (name: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const value = request.headers[`roblox-${name}`];
    if (!value) {
      return undefined;
    }
    return Buffer.from(value, "base64").toString("utf-8");
  }
);
