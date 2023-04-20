export class KycError extends Error {
  static readonly MESSAGE =
    "You must be verified through KYC to withdraw more than $2,000.";
  static readonly THRESHOLD = 2_000;

  static assert(verified: boolean, withdrawn: number) {
    if (!verified && withdrawn > KycError.THRESHOLD) {
      throw new KycError();
    }
  }

  constructor() {
    super(KycError.MESSAGE);
    this.name = "KycError";
  }
}
