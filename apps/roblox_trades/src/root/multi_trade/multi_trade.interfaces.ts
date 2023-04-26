import type {
  MultiTradeUser,
  MultiTradeChild,
  MultiTradeStatus,
} from "./multi_trade.entity.js";

export interface AddMultiTradePayload {
  children: MultiTradeChild[];
  users: [number, MultiTradeUser][];
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
  ok: boolean;
  status: MultiTradeStatus;

  senderIds: number[];
  receiverIds: number[];
  userAssetIds: number[];
  recyclableUserAssetIds: number[];

  participantDetails: [number, MultiTradeResultParticipant][]; // userId -> participantDetails
  ownershipDetails: {
    userAssetIds: [number, number[]][]; // userId -> userAssetIds
    recyclableUserAssetIds: [number, number[]][]; // userId -> userAssetIds
  };

  errors: NonNullable<MultiTradeChild["error"]>[];
}
