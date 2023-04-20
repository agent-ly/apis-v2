export class AmountZeroError extends Error {
  static readonly MESSAGE = "Amount must be non-zero.";

  static assert(amount: number) {
    if (amount === 0) {
      throw new AmountZeroError();
    }
  }

  constructor() {
    super(AmountZeroError.MESSAGE);
    this.name = "AmountZeroError";
  }
}
