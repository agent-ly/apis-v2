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
  Start_Trade = "start_trade",
  Wait_Trade = "wait_trade",
}

export const enum MultiTradeJobStrategy {
  Sender_To_Receiver = "sender_to_receiver",
  Receiver_To_Sender = "receiver_to_sender",
}

export interface MultiTradeJob {
  strategy: MultiTradeJobStrategy;

  offerFromUserId: number;
  offerToUserId: number;
  userAssetIds: number[];

  refId: string | null;
  refStatus: SingleTradeStatus | null;
  tradeId: number | null;
  tradeStatus: string | null;

  startedAt: Date | null;
  processedAt: Date | null;
}

export interface MultiTradeCredential {
  roblosecurity: string;
  totpSecret?: string;
}

export interface MultiTrade {
  _id: string;

  status: MultiTradeStatus;
  step: MultiTradeStep;

  currentJobIndex: number | null;
  jobs: MultiTradeJob[];

  credentials: Map<number, MultiTradeCredential> | null; // userId -> credentials
  userAssetIds: Map<number, number[]>; // userId -> userAssetIds
  recyclableUserAssetIds: Map<number, number[]>; // userId -> userAssetIds

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
    "credentials" | "userAssetIds" | "recyclableUserAssetIds"
  > {
  credentials: [number, MultiTradeCredential][] | null;
  userAssetIds: [number, number[]][];
  recyclableUserAssetIds: [number, number[]][];
}
