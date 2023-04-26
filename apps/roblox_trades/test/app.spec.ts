import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { FastifyAdapter } from "@nestjs/platform-fastify";
import { WsAdapter } from "@nestjs/platform-ws";
import { getMongoConnectionToken } from "nestjs-super-mongodb";
import { TradesApi } from "roblox-proxy-nestjs/apis/trades.api";
import { TwoStepApi } from "roblox-proxy-nestjs/apis/two_step.api";
import { describe, it, beforeAll, afterAll, expect, vi } from "vitest";
import { request, spec } from "pactum";
import { WebSocket } from "ws";

import { SINGLE_TRADE_PROMPT_CHALLENGE_EVENT } from "../src/root/single_trade/single_trade.constants.js";
import { MULTI_TRADE_PROCESSED_EVENT } from "../src/root/multi_trade/multi_trade.constants.js";
import { AppModule } from "../src/app.module.js";

import { openWs, strictNextEvent } from "./utils/ws.js";
import { fixtures, errorFixtures } from "./fixtures.js";

describe("Roblox Trades", () => {
  let app: INestApplication;
  let url: string;
  let ws: WebSocket;
  let tradesApi: TradesApi;
  let twoStepApi: TwoStepApi;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication(new FastifyAdapter());
    app.useWebSocketAdapter(new WsAdapter(app));
    tradesApi = app.get(TradesApi);
    twoStepApi = app.get(TwoStepApi);
    vi.spyOn(tradesApi, "sendTrade").mockResolvedValue({ id: 1 });
    vi.spyOn(tradesApi, "acceptTrade").mockResolvedValue({});
    vi.spyOn(tradesApi, "getTrade").mockResolvedValue({
      id: 1,
      status: "Completed",
      isActive: true,
      user: {
        id: 1,
        name: "",
      },
      offers: [],
      created: "",
      expiration: "",
    });
    vi.spyOn(twoStepApi, "verifyCode").mockResolvedValue({
      verificationToken: "test",
    });
    const client = app.get(getMongoConnectionToken());
    await client.db().collection("single_trades").deleteMany({});
    await client.db().collection("multi_trades").deleteMany({});
    await app.listen(0);
    url = await app.getUrl();
    ws = await openWs(url);
    request.setBaseUrl(url);
  });

  afterAll(async () => {
    ws.close();
    await app.close();
  });

  describe("Core", () => {
    it.each([
      ["one-to-one sender_to_receiver", fixtures[0]],
      ["one-to-one receiver_to_sender", fixtures[1]],
      ["many-to-one sender_to_receiver", fixtures[2]],
      ["many-to-one receiver_to_sender", fixtures[3]],
    ])(
      "Starts and completes a %s multi-trade",
      async (name, { input, output }) => {
        const path = name.startsWith("one-to-one")
          ? "/add-one-to-one-multi-trade"
          : "/add-many-to-one-multi-trade";
        await spec().post(path).withJson(input).expectStatus(201);
        const event = await strictNextEvent(ws, MULTI_TRADE_PROCESSED_EVENT);
        expect(event.data.status).toEqual(output.status);
        expect(event.data.senderIds).toEqual(output.senderIds);
        expect(event.data.receiverIds).toEqual(output.receiverIds);
        expect(event.data.participantDetails).toEqual(
          output.participantDetails
        );
      },
      { timeout: 15e3 }
    );
  });

  describe("Errors", () => {
    it(
      "Should handle a trade challenge error",
      async () => {
        vi.spyOn(tradesApi, "sendTrade").mockRejectedValueOnce(
          errorFixtures[0].sendTrade
        );
        await spec()
          .post("/add-one-to-one-multi-trade")
          .withJson(fixtures[0].input)
          .expectStatus(201);
        const challengeEvent = await strictNextEvent(
          ws,
          SINGLE_TRADE_PROMPT_CHALLENGE_EVENT
        );
        expect(challengeEvent.data.userId).toEqual(1);
        await spec()
          .post(
            `/single-trades/${challengeEvent.data.singleTradeId}/${challengeEvent.data.userId}/solve-challenge`
          )
          .withQueryParams({
            code: "123456",
          })
          .expectStatus(200);
        const processedEvent = await strictNextEvent(
          ws,
          MULTI_TRADE_PROCESSED_EVENT
        );
        expect(processedEvent.data.status).toEqual("finished");
      },
      { timeout: 10e3 }
    );
    it.only(
      "Should fail for being paused for too long",
      async () => {
        vi.spyOn(tradesApi, "sendTrade").mockRejectedValueOnce(
          errorFixtures[0].sendTrade
        );
        vi.useFakeTimers();
        await spec()
          .post("/add-one-to-one-multi-trade")
          .withJson(fixtures[0].input)
          .expectStatus(201);
        await strictNextEvent(ws, SINGLE_TRADE_PROMPT_CHALLENGE_EVENT);
        vi.advanceTimersToNextTimerAsync();
        vi.useRealTimers();
        const event = await strictNextEvent(ws, MULTI_TRADE_PROCESSED_EVENT);
        expect(event.data.status).toEqual("finished");
        expect(event.data.errors).toEqual([
          {
            statusCode: 408,
            errorCode: -1,
            message: "Pause timed out.",
            name: "TradeTimeoutError",
            field: "userId",
            fieldData: 1,
          },
        ]);
      },
      { timeout: 10e3 }
    );
  });
});
