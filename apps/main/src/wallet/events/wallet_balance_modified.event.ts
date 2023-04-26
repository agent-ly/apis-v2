import { TransactionEvent } from "../transactions/enums/transaction_event.enum.js";

export class WalletBalanceModifiedEvent {
  static readonly EVENT = "wallet.balance.modified";

  public readonly userId: string;
  public readonly event: TransactionEvent;
  public readonly amount: number;

  constructor(params: WalletBalanceModifiedEventParams) {
    this.userId = params.userId;
    this.event = params.event;
    this.amount = params.amount;
  }
}

interface WalletBalanceModifiedEventParams {
  userId: string;
  event: TransactionEvent;
  amount: number;
}
