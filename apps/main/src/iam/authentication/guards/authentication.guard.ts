import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Observable, lastValueFrom } from "rxjs";

import { AuthStrategy } from "../enums/auth_strategy.enum.js";
import { AUTH_STRATEGY_METADATA_KEY } from "../decorators/auth.decorator.js";
import { IpGuard } from "./ip.guard.js";
import { BearerTokenGuard } from "./bearer_token.guard.js";

const NOOP_GUARD: CanActivate = { canActivate: () => true };

@Injectable()
export class AuthenticationGuard implements CanActivate {
  private static readonly DEFAULT_AUTH_STRATEGY = AuthStrategy.None;
  private readonly authGuardStrategies: Record<
    AuthStrategy,
    CanActivate | CanActivate[]
  >;

  constructor(
    private readonly reflector: Reflector,
    private readonly ipGuard: IpGuard,
    private readonly bearerTokenGuard: BearerTokenGuard
  ) {
    this.authGuardStrategies = {
      [AuthStrategy.None]: NOOP_GUARD,
      [AuthStrategy.Ip]: this.ipGuard,
      [AuthStrategy.Bearer]: this.bearerTokenGuard,
    };
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    console.log("AuthenticationGuard.canActivate");
    const strategies = this.reflector.getAllAndOverride<AuthStrategy[]>(
      AUTH_STRATEGY_METADATA_KEY,
      [context.getHandler(), context.getClass()]
    ) ?? [AuthenticationGuard.DEFAULT_AUTH_STRATEGY];
    const guards = strategies
      .map((strategy) => this.authGuardStrategies[strategy])
      .flat();
    for (const guard of guards) {
      let result = guard.canActivate(context);
      if (result instanceof Promise) {
        result = await result;
      }
      if (result instanceof Observable) {
        result = await lastValueFrom(result);
      }
    }
    return true;
  }
}
