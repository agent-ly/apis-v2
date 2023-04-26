export interface MultiTradeError {
  statusCode: number;
  errorCode: number;
  message: string;
  name?: string;
  url?: string;
  field?: string;
  fieldData?: unknown;
}

export const enum MultiTradeStatus {
  Pending = "pending",
  Processing = "processing",
  Finished = "finished",
  Failed = "failed",
}

export interface MultiTrade {
  id: string;
  status: MultiTradeStatus;
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
  participantDetails: [number, MultiTradeResultParticipant][];
  ownershipDetails: {
    userAssetIds: [number, number[]][];
    recyclableUserAssetIds: [number, number[]][];
  };
  errors: MultiTradeError[];
}

export interface StartMultiTradeUser {
  id: number;
  roblosecurity: string;
  roblosecret?: string;
  userAssetIds: number[];
  recyclableUserAssetIds: number[];
}

export const enum StartMultiTradeStrategy {
  Sender_To_Receiver = "sender_to_receiver",
  Receiver_To_Sender = "receiver_to_sender",
}

export interface StartMultiTradePayload {
  maxItemsPerTrade: number;
  strategy: StartMultiTradeStrategy;
  receiver: StartMultiTradeUser;
  senders: StartMultiTradeUser[];
}
