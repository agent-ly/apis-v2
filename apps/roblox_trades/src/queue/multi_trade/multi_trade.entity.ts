import type {
  SingleTrade,
  SingleTradeStatus,
} from "../single_trade/single_trade.entity.js";

export const enum MultiTradeStatus {
  Pending = "pending",
  Processing = "processing",
  Finished = "finished",
  Failed = "failed",
}

export const enum MultiTradeStep {
  None = "none",
  Start_Child = "start_child",
  Wait_Child = "wait_child",
}

export const enum MultiTradeChildStrategy {
  Sender_To_Receiver = "sender_to_receiver",
  Receiver_To_Sender = "receiver_to_sender",
}

export interface MultiTradeChild {
  strategy: MultiTradeChildStrategy;

  offerFromUserId: number;
  offerToUserId: number;
  offerFromUserAssetIds: number[];
  offerToUserAssetIds: number[];

  id: string | null;
  status: SingleTradeStatus | null;
  tradeId: number | null;
  tradeStatus: string | null;

  startedAt: Date | null;
  processedAt: Date | null;
}

export interface MultiTradeUser {
  roblosecurity: string;
  totpSecret?: string;
}

export interface MultiTrade {
  _id: string;

  status: MultiTradeStatus;
  step: MultiTradeStep;

  users: Map<number, MultiTradeUser> | null; // userId -> user
  userAssetIds: Map<number, number[]>; // userId -> userAssetIds
  recyclableUserAssetIds: Map<number, number[]>; // userId -> userAssetIds

  children: MultiTradeChild[];
  current: number | null;

  error: SingleTrade["error"];

  startedAt: Date | null;
  processedAt: Date | null;
  acknowledgedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

export interface SerializedMultiTrade
  extends Omit<
    MultiTrade,
    "users" | "userAssetIds" | "recyclableUserAssetIds"
  > {
  users: string | null;
  userAssetIds: [number, number[]][];
  recyclableUserAssetIds: [number, number[]][];
}
