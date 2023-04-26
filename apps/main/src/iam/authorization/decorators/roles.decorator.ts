import { SetMetadata } from "@nestjs/common";

import { UserRole } from "../../../users/enums/user_role.enum.js";

export const ROLES_METADATA_KEY = "user:roles";

export const Roles = (...roles: UserRole[]) =>
  SetMetadata(ROLES_METADATA_KEY, roles);
