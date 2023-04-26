import { UserRole } from "../../../users/enums/user_role.enum.js";
import { Roles } from "./roles.decorator.js";

export const AdminOnly = () => Roles(UserRole.Owner, UserRole.Admin);
