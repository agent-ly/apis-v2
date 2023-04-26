export interface Block {
  blockHeight: number;
  blockTime: number;
  blockhash: string;
  parentSlot: number;
  previousBlockhash: string;
}
