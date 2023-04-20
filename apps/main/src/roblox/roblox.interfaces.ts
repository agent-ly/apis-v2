export interface ApiError {
  message: string;
}

export type ControlledResponse<TData = unknown> =
  | {
      ok: true;
      data: TData;
    }
  | {
      ok: false;
      error: string;
      message?: string;
      details?: unknown;
    };

export interface Collectible {
  userAssetId: number;
  assetId: number;
  serialNumber: number | null;
  name: string;
  recentAveragePrice: number;
}

export type GetUserCollectiblesResponse = ControlledResponse<Collectible[]>;

export interface AuthenticatedUser {
  id: number;
  name: string;
  displayName: string;
}

export type GetAuthenticatedUserResponse =
  ControlledResponse<AuthenticatedUser>;

export type CanAuthenticatedUserTradeResponse =
  | {
      ok: true;
    }
  | {
      ok: false;
      error: string;
      message: string;
    };

export interface MultiTradeError {
  statusCode: number;
  errorCode: number;
  message: string;
  url?: string;
  field?: string;
  fieldData?: unknown;
}

export enum MultiTradeStatus {
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
  status: MultiTradeStatus;
  ok: boolean;
  senderIds: number[];
  receiverIds: number[];
  userAssetIds: number[];
  recyclableUserAssetIds: number[];
  participantDetails: [number, MultiTradeResultParticipant][];
  ownershipDetails: {
    userAssetIds: [number, number[]][];
    recyclableUserAssetIds: [number, number[]][];
  };
  error: MultiTradeError | null;
}

export interface AddMultiTradeUser {
  id: number;
  roblosecurity: string;
  totpSecret?: string;
  userAssetIds: number[];
  recyclableUserAssetIds: number[];
}

export enum AddMultiTradeStrategy {
  Sender_To_Receiver = "sender_to_receiver",
  Receiver_To_Sender = "receiver_to_sender",
}

export interface AddMultiTradePayload {
  maxItemsPerTrade: number;
  strategy: AddMultiTradeStrategy;
  sender: AddMultiTradeUser;
  receiver: AddMultiTradeUser;
}
