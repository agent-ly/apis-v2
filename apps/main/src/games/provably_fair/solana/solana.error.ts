export class SolanaError extends Error {
  public static readonly ERROR_CODES = {
    BLOCK_NOT_AVAILABLE: -32004,
    SLOT_SKIPPED: -32007,
  };

  public readonly code: number;

  constructor(code: number, message: string) {
    super(message);
    this.code = code;
    this.name = "SolanaError";
  }
}
