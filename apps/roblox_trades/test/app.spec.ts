import { execSync } from "node:child_process";
import type { INestApplication } from "@nestjs/common";
import { FastifyAdapter } from "@nestjs/platform-fastify";
import { WsAdapter } from "@nestjs/platform-ws";
import { Test } from "@nestjs/testing";
import { describe, it, beforeAll, afterAll } from "vitest";
import { request, spec } from "pactum";
import { WebSocket } from "ws";

import { MULTI_TRADE_PROCESSED_EVENT } from "../src/queue/multi_trade/multi_trade.constants.js";
import { AppModule } from "../src/app.module.js";
import { TradesApiMock } from "./mocks/trades.api.mock.js";

execSync('docker exec mongo mongosh --quiet --eval "db.dropDatabase()"');
execSync("docker exec redis redis-cli -n 1 flushdb");

describe("Roblox Trades", () => {
  let app: INestApplication;
  let url: string;
  let ws: WebSocket;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(TradesApiMock.provide)
      .useValue(TradesApiMock.useValue)
      .compile();
    app = module.createNestApplication(new FastifyAdapter());
    app.useWebSocketAdapter(new WsAdapter(app));
    await app.listen(0);
    url = await app.getUrl();
    request.setBaseUrl(url);
  });

  it("Starts a multi-trade", () =>
    spec()
      .post("/queue/add")
      .withJson({
        maxItemsPerTrade: 3,
        strategy: "sender_to_receiver",
        sender: {
          id: 1,
          roblosecurity: "abcdefg",
          userAssetIds: [1, 2, 3],
          recyclableUserAssetIds: [4],
        },
        receiver: {
          id: 2,
          roblosecurity: "hijklmn",
          userAssetIds: [],
          recyclableUserAssetIds: [5],
        },
      })
      .expectStatus(201)
      .stores("multiTradeId", ""));

  it("Gets the multi-trade", () =>
    spec()
      .get("/multi-trades/{multiTradeId}")
      .withPathParams("multiTradeId", "$S{multiTradeId}")
      .expectStatus(200));

  it(
    "Waits for the multi-trade to finish",
    () =>
      new Promise<void>((resolve, reject) => {
        ws = new WebSocket(url.replace("http", "ws"));
        ws.on("message", (data) => {
          const message = JSON.parse(data.toString());
          if (message.event === MULTI_TRADE_PROCESSED_EVENT) {
            ws.close();
            resolve();
          }
        });
        ws.on("error", reject);
      }),
    { timeout: 15e3 }
  );

  afterAll(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
    app.close();
  });
});
