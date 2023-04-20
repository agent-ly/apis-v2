export class AmlError extends Error {
  static readonly MESSAGE =
    "Per AML regulations, you must wager at as much as you have deposited.";

  static assert(wagered: number, deposited: number) {
    if (wagered < deposited) {
      throw new AmlError();
    }
  }

  constructor() {
    super(AmlError.MESSAGE);
    this.name = "AmlError";
  }
}
