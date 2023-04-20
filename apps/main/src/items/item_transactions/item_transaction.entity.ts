import { Doc } from "../../common/interfaces/doc.interface.js";
import { ItemTransactionEvent } from "./enums/item_transaction_event.enum.js";
import { ItemTransactionStatus } from "./enums/item_transaction_status.enum.js";
import { ItemTransactionType } from "./enums/item_transaction_type.enum.js";

export interface ItemTransaction<TDetails = unknown> extends Doc {
  jobId: string | null;
  userId: string;
  senderId: number;
  receiverId: number;
  type: ItemTransactionType;
  event: ItemTransactionEvent;
  status: ItemTransactionStatus;
  data: string | null;
  details: TDetails | null;
}
