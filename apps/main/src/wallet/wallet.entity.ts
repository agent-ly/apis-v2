import { Doc } from "../common/interfaces/doc.interface.js";

export interface Wallet extends Doc {
  enabled: boolean;
  verified: boolean;
  balance: number;
  deposited: number;
  withdrawn: number;
  wagered: number;
  won: number;
  sold: number;
  bought: number;
  lockedAt: Date | null;
}
