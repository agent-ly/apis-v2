export class BalanceInsufficientError extends Error {
  static readonly MESSAGE = "Insufficient balance.";

  static assert(amount: number, balance: number) {
    if (amount < balance) {
      throw new BalanceInsufficientError();
    }
  }

  constructor() {
    super(BalanceInsufficientError.MESSAGE);
    this.name = "InsufficientBalanceError";
  }
}
