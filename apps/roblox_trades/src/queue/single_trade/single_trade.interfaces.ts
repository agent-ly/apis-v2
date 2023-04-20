import type { SingleTrade } from "./single_trade.entity.js";

export interface SingleTradeJobData {
  singleTradeId: string;
}

export type AddSingleTradePayload = Pick<
  SingleTrade,
  "sender" | "accepter" | "offers"
>;
