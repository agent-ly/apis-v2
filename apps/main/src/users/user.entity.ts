import { Doc } from "../common/interfaces/doc.interface.js";
import { UserBadge } from "./enums/user_badge.enum.js";
import { UserRole } from "./enums/user_role.enum.js";
import { UserTag } from "./enums/user_tag.enum.js";
import { WagerCurrency } from "../wagers/enums/wager_currency.enum.js";
import { WagerGame } from "../wagers/enums/wager_game.enum.js";

export interface User extends Doc {
  name: string;
  experience: number;
  level: number;
  role: UserRole;
  stats: Partial<UserStats>;
  badges: Partial<Record<UserBadge, Date>>;
  tags: Partial<Record<UserTag, UserTagEntry>>;
  lastLoginAt: Date | null;
}

interface UserStats {
  won: Partial<Record<WagerGame, number>>;
  lost: Partial<Record<WagerGame, number>>;
  wagered: Partial<Record<WagerCurrency, number>>;
  profited: Partial<Record<WagerCurrency, number>>;
}

interface UserTagEntry {
  issuerId: string;
  issuedAt: Date;
  expiresAt: Date;
}
