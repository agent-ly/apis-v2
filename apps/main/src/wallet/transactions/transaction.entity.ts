import { Doc } from "../../common/interfaces/doc.interface.js";
import { TransactionEvent } from "./enums/transaction_event.enum.js";
import { TransactionType } from "./enums/transaction_type.enum.js";

export interface Transaction<TDetails = unknown> extends Doc {
  userId: string;
  type: TransactionType;
  event: TransactionEvent;
  amount: number;
  previousBalance: number;
  newBalance: number;
  details: TDetails | null;
}
