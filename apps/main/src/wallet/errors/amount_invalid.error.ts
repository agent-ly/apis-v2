export class AmountInvalidError extends Error {
  static readonly MESSAGE = "Amount is invalid.";

  static assertPositive(amount: number) {
    if (amount < 0) {
      throw new AmountInvalidError();
    }
  }

  static assertNegative(amount: number) {
    if (amount > 0) {
      throw new AmountInvalidError();
    }
  }

  constructor() {
    super(AmountInvalidError.MESSAGE);
    this.name = "AmountInvalidError";
  }
}
