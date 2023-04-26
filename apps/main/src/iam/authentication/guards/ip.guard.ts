import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";

@Injectable()
export class IpGuard implements CanActivate {
  private static readonly ALLOW_LIST = new Set<string>([]);

  constructor() {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    if (!IpGuard.ALLOW_LIST.has(request.ip)) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
