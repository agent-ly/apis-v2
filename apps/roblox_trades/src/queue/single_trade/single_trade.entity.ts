import type { NormalizedRobloxApiError } from "roblox-proxy-nestjs";
import type { TradeStatus } from "roblox-proxy-nestjs/apis/trades.api";

export const enum SingleTradeStatus {
  Pending = "pending",
  Processing = "processing",
  Finished = "finished",
  Failed = "failed",
  Delayed = "delayed",
  Backlogged = "backlogged",
}

export const enum SingleTradeStep {
  None = "none",
  Start_Trade = "start_trade",
  Wait_Trade = "wait_trade",
}

export const enum SingleTradeDepth {
  None = "none",
  Prepare_Trade = "prepare_trade",
  Send_Trade = "send_trade",
  Accept_Trade = "accept_trade",
  Check_Trade_As_Sender = "check_trade_as_sender",
  Check_Trade_As_Accepter = "check_trade_as_accepter",
}

export interface SingleTradeUser {
  id: number;
  credentials: {
    roblosecurity: string;
    totpSecret?: string;
    totpCode?: string;
  } | null;
}

export interface SingleTradeOffer {
  userId: number;
  userAssetIds?: number[];
  recyclableUserAssetId?: number;
}

export interface SingleTrade {
  _id: string;

  status: SingleTradeStatus;
  step: SingleTradeStep;
  depth: SingleTradeDepth;

  sender: SingleTradeUser;
  accepter: SingleTradeUser;
  offers: [SingleTradeOffer, SingleTradeOffer]; // [senderOffer, accepterOffer]

  trade: {
    id: number;
    status: TradeStatus;
  } | null;

  error: NormalizedRobloxApiError | null;

  startedAt: Date | null;
  processedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}
