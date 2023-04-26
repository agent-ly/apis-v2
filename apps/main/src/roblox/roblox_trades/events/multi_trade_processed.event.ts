import type { MultiTradeResult } from "../roblox_trades.interfaces.js";

export class MultiTradeProcessedEvent {
  public static readonly EVENT = "roblox.multi-trade.processed";

  public readonly result: MultiTradeResult;

  constructor(result: MultiTradeResult) {
    this.result = result;
  }
}
