import { EventEmitter2, OnEvent } from "@nestjs/event-emitter";
import {
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { WebSocket, type WebSocketServer as WsServer } from "ws";

import type { SingleTradeChallengeEvent } from "./single_trade.interfaces.js";
import {
  SINGLE_TRADE_CHALLENGE_EVENT,
  SINGLE_TRADE_AUTHORIZE_EVENT,
} from "./single_trade.constants.js";

@WebSocketGateway()
export class SingleTradeGateway {
  @WebSocketServer()
  server: WsServer;

  constructor(private readonly eventEmitter: EventEmitter2) {}

  @SubscribeMessage(SINGLE_TRADE_AUTHORIZE_EVENT)
  onSingleTradeAuthorized(
    @MessageBody() payload: SingleTradeChallengeEvent
  ): void {
    this.eventEmitter.emit(SINGLE_TRADE_AUTHORIZE_EVENT, payload);
  }

  @OnEvent(SINGLE_TRADE_CHALLENGE_EVENT)
  onSingleTradeChallenged(payload: SingleTradeChallengeEvent): void {
    this.broadcastEvent(SINGLE_TRADE_CHALLENGE_EVENT, payload);
  }

  private broadcastEvent(event: string, data: unknown): void {
    this.broadcastMessage(JSON.stringify({ event, data }));
  }

  private broadcastMessage(data: string): void {
    this.server.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }
}
