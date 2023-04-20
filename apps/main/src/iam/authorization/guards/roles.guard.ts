import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { UserRole } from "../../../users/enums/user_role.enum.js";
import type { ActiveUserData } from "../../interfaces/active_user_data.interface.js";
import { REQUEST_USER_KEY } from "../../iam.constants.js";
import { ROLES_METADATA_KEY } from "../decorators/roles.decorator.js";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_METADATA_KEY,
      [context.getHandler(), context.getClass()]
    );
    if (!roles) {
      return true;
    }
    const user: ActiveUserData = context.switchToHttp().getRequest()[
      REQUEST_USER_KEY
    ];
    return roles.some((role) => user.role === role);
  }
}
