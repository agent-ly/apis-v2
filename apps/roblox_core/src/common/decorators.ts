import {
  createParamDecorator,
  UnauthorizedException,
  type ExecutionContext,
} from "@nestjs/common";

interface RoblosecurityOptions {
  optional?: boolean;
}

export const Roblosecurity = createParamDecorator(
  (options: RoblosecurityOptions, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const base64Roblosecurity = request.headers["x-roblosecurity"];
    if (!base64Roblosecurity) {
      if (options?.optional) {
        return null;
      }
      throw new UnauthorizedException("Missing x-roblosecurity header.");
    }
    const roblosecurity = Buffer.from(base64Roblosecurity, "base64").toString(
      "utf-8"
    );
    return roblosecurity;
  }
);
