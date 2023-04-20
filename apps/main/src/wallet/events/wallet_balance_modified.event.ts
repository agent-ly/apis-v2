export class WalletBalanceModifiedEvent {
  static readonly EVENT = "wallet.balance.modified";
  constructor(public readonly userId: string, public readonly amount: number) {}
}
