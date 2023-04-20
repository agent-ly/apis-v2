import type { MultiTradeResult } from "../../../roblox/roblox.interfaces.js";
import type { ItemTransaction } from "../item_transaction.entity.js";

export class ItemTransactionProcessedEvent {
  constructor(
    public readonly transaction: ItemTransaction,
    public readonly result: MultiTradeResult
  ) {}
}
