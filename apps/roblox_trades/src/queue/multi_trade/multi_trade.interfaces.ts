import type {
  MultiTrade,
  MultiTradeCredential,
  MultiTradeJob,
  MultiTradeStatus,
} from "./multi_trade.entity.js";

export interface MultiTradeJobData {
  multiTradeId: string;
}

export interface AddMultiTradePayload {
  jobs: MultiTradeJob[];
  credentials: [number, MultiTradeCredential][];
  userAssetIds: [number, number[]][];
  recyclableUserAssetIds: [number, number[]][];
}

export interface MultiTradeResultParticipant {
  tradesSent: number;
  tradesReceived: number;
  tradesCompleted: number;
  tradesFailed: number;
}

export interface MultiTradeResult {
  id: string;
  status: MultiTradeStatus;
  ok: boolean;

  senderIds: number[];
  receiverIds: number[];
  userAssetIds: number[];
  recyclableUserAssetIds: number[];

  participantDetails: [number, MultiTradeResultParticipant][]; // userId -> participantDetails
  ownershipDetails: {
    userAssetIds: [number, number[]][]; // userId -> userAssetIds
    recyclableUserAssetIds: [number, number[]][]; // userId -> userAssetIds
  };

  error: MultiTrade["error"];
}