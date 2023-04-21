import type { SingleTrade } from "./single_trade.entity.js";

export interface SingleTradeJobData {
  singleTradeId: string;
}

export type AddSingleTradePayload = Pick<
  SingleTrade,
  "parentId" | "sender" | "accepter" | "offers"
>;

export interface SingleTradeChallengeEvent {
  singleTradeId: string;
  userId: number;
}

export interface SingleTradeAuthorizeEvent {
  singleTradeId: string;
  userId: number;
  secret?: string;
  code?: string;
}
