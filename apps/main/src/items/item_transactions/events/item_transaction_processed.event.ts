import type { MultiTradeResult } from "../../../roblox/roblox_trades/roblox_trades.interfaces.js";
import { ItemTransactionEvent } from "../enums/item_transaction_event.enum.js";
import type { ItemTransaction } from "../item_transaction.entity.js";

export class ItemTransactionProcessedEvent<
  TTransaction extends ItemTransaction = ItemTransaction
> {
  public static EVENT = "item_transaction.processed";

  public static getName(event: ItemTransactionEvent) {
    return `${ItemTransactionProcessedEvent.EVENT}.${event}`;
  }

  public readonly transaction: TTransaction;
  public readonly result: MultiTradeResult;

  constructor(params: ItemTransactionProcessedEventParams<TTransaction>) {
    this.transaction = params.transaction;
    this.result = params.result;
  }
}

interface ItemTransactionProcessedEventParams<
  TTransaction extends ItemTransaction = ItemTransaction
> {
  transaction: TTransaction;
  result: MultiTradeResult;
}
