export class BalanceLockedError extends Error {
  static readonly MESSAGE = "Balance is locked.";

  static assert(locked: boolean) {
    if (locked) {
      throw new BalanceLockedError();
    }
  }

  constructor() {
    super(BalanceLockedError.MESSAGE);
    this.name = "BalanceLockedError";
  }
}
