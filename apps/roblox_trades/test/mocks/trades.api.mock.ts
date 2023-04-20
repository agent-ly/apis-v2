import type { ValueProvider } from "@nestjs/common";
import {
  type GetTradeResponse,
  TradesApi,
} from "roblox-proxy-nestjs/apis/trades.api";

import { createRobloxApiErrorResponse } from "./util.js";

const trades = new Map<number, GetTradeResponse>();

const getTradeOrThrow = (tradeId: number) => {
  const trade = trades.get(tradeId);
  if (!trade) {
    throw createRobloxApiErrorResponse(
      400,
      2,
      "The trade cannot be found or you are not authorized to view it."
    );
  }
  return trade;
};

export const TradesApiMock: ValueProvider<Partial<TradesApi>> = {
  provide: TradesApi,
  useValue: {
    getTrade(_roblosecurity, tradeId) {
      const trade = getTradeOrThrow(tradeId);
      return Promise.resolve(trade);
    },
    sendTrade(_roblosecurity, data) {
      const offers = data.offers.map((offer) => ({
        user: {
          id: offer.userId,
          name: "test",
        },
        userAssets: offer.userAssetIds.map((id) => ({
          id,
          assetId: 0,
          serialNumber: 0,
          name: "test",
        })),
      }));
      const [offer] = data.offers;
      const trade: GetTradeResponse = {
        id: trades.size + 1,
        isActive: true,
        status: "Open",
        user: {
          id: offer.userId,
          name: "test",
        },
        offers,
        created: new Date().toISOString(),
        expiration: new Date().toISOString(),
      };
      trades.set(trade.id, trade);
      return Promise.resolve({ id: trade.id });
    },
    acceptTrade(_roblosecurity, tradeId) {
      const trade = getTradeOrThrow(tradeId);
      trade.isActive = false;
      trade.status = "Completed";
      return Promise.resolve({});
    },
  },
};
