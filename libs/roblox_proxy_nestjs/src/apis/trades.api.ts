import { Injectable } from "@nestjs/common";

import { RobloxClient } from "../roblox.client.js";

export type TradeStatus =
  | "Unknown"
  | "Open"
  | "Pending"
  | "Completed"
  | "Expired"
  | "RejectedDueToError"
  | "Countered"
  | "Processing"
  | "InterventionRequired";

interface TradeUser {
  id: number;
  name: string;
}

interface TradeUserAsset {
  id: number;
  assetId: number;
  serialNumber: number;
  name: string;
}

interface TradeOffer {
  user: TradeUser;
  userAssets: TradeUserAsset[];
}

export interface GetTradeResponse {
  id: number;
  isActive: boolean;
  status: TradeStatus;
  user: TradeUser;
  offers: TradeOffer[];
  created: string;
  expiration: string;
}

export interface TradeOfferPayload {
  userId: number;
  userAssetIds: number[];
}

export interface SendTradePayload {
  offers: TradeOfferPayload[];
}

export interface SendTradeResponse {
  id: number;
}

export interface RedeemTwoStepChallengePayload {
  challengeToken: string;
  verificationToken: string;
}

@Injectable()
export class TradesApi {
  constructor(private readonly client: RobloxClient) {}

  getTrade(roblosecurity: string, tradeId: number): Promise<GetTradeResponse> {
    const url = `https://trades.roblox.com/v1/trades/${tradeId}`;
    const init = { roblosecurity };
    return this.client.json<GetTradeResponse>(url, init);
  }

  sendTrade(
    roblosecurity: string,
    data: SendTradePayload,
    headers?: Record<string, any>
  ): Promise<SendTradeResponse> {
    const url = `https://trades.roblox.com/v1/trades/send`;
    const init = { roblosecurity, method: "POST", headers, data };
    return this.client.json<SendTradeResponse>(url, init);
  }

  acceptTrade(
    roblosecurity: string,
    tradeId: number,
    headers?: Record<string, any>
  ): Promise<{}> {
    const url = `https://trades.roblox.com/v1/trades/${tradeId}/accept`;
    const init = { roblosecurity, method: "POST", headers };
    return this.client.json<{}>(url, init);
  }

  declineTrade(roblosecurity: string, tradeId: number): Promise<{}> {
    const url = `https://trades.roblox.com/v1/trades/${tradeId}/decline`;
    const init = { roblosecurity, method: "POST" };
    return this.client.json<{}>(url, init);
  }

  generateTwoStepChallenge(roblosecurity: string): Promise<string> {
    const url =
      "https://trades.roblox.com/v1/trade-friction/two-step-verification/generate";
    const init = { roblosecurity, method: "POST" };
    return this.client.json<string>(url, init);
  }

  redeemTwoStepChallenge(
    roblosecurity: string,
    data: RedeemTwoStepChallengePayload
  ): Promise<boolean> {
    const url =
      "https://trades.roblox.com/v1/trade-friction/two-step-verification/redeem";
    const init = { roblosecurity, method: "POST", data };
    return this.client.json<boolean>(url, init);
  }
}
