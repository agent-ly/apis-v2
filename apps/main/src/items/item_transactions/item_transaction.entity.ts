import { Doc } from "../../common/interfaces/doc.interface.js";
import { ItemTransactionEvent } from "./enums/item_transaction_event.enum.js";
import { ItemTransactionStatus } from "./enums/item_transaction_status.enum.js";
import { ItemTransactionType } from "./enums/item_transaction_type.enum.js";

export interface ItemTransaction extends Doc {
  jobId: string | null;
  userId: string;
  robloUserId: number;
  type: ItemTransactionType;
  event: ItemTransactionEvent;
  status: ItemTransactionStatus;
  data: string | null;
  details: unknown | null;
}

export interface DepositItemTransaction extends ItemTransaction {
  robloReceiverId: number;
  type: ItemTransactionType.Deposit;
  event: ItemTransactionEvent.Bot_Deposit;
}

export interface WithdrawItemTransaction extends ItemTransaction {
  robloSenderIds: number[];
  type: ItemTransactionType.Withdraw;
  event: ItemTransactionEvent.Bot_Withdraw | ItemTransactionEvent.Shop_Withdraw;
}
