import { type ExecutionContext, createParamDecorator } from "@nestjs/common";

export const ActiveRobloxUser = createParamDecorator(
  (field: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const robloxUser = request.robloxUser;
    return field ? robloxUser && robloxUser[field] : robloxUser;
  }
);
