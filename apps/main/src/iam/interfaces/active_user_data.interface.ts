import { UserRole } from "../../users/enums/user_role.enum.js";

export interface ActiveUserData {
  sub: string;
  name: string;
  role: UserRole;
}
