import { Doc } from "../common/interfaces/doc.interface.js";
import { WagerCurrency } from "./enums/wager_currency.enum.js";
import { WagerGame } from "./enums/wager_game.enum.js";
import { WagerResult } from "./enums/wager_result.enum.js";
import { WagerStatus } from "./enums/wager_status.enum.js";
import { WagerProfit } from "./interfaces/wager_profit.interface.js";

export interface Wager<TDetails = unknown> extends Doc {
  userId: string;
  gameId: string;
  game: WagerGame;
  currency: WagerCurrency;
  status: WagerStatus;
  amount: number;
  result: WagerResult | null;
  profit: WagerProfit | null;
  details: TDetails | null;
}
