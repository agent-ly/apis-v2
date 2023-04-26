export class BalanceLockedError extends Error {
  static readonly MESSAGE = "Balance is locked.";

  static assert(locked: boolean) {
    if (locked) {
      throw new BalanceLockedError();
    }
  }
  public readonly statusCode = 400;

  constructor() {
    super(BalanceLockedError.MESSAGE);
    this.name = "BalanceLockedError";
  }
}
