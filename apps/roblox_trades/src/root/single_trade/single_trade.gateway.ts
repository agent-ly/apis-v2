import { OnEvent } from "@nestjs/event-emitter";
import { WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { WebSocket, type WebSocketServer as WsServer } from "ws";

import type { SingleTradePromptChallengeEvent } from "./single_trade.interfaces.js";
import { SINGLE_TRADE_PROMPT_CHALLENGE_EVENT } from "./single_trade.constants.js";

@WebSocketGateway()
export class SingleTradeGateway {
  @WebSocketServer()
  server: WsServer;

  @OnEvent(SINGLE_TRADE_PROMPT_CHALLENGE_EVENT)
  onSingleTradeChallenged(payload: SingleTradePromptChallengeEvent): void {
    this.broadcastEvent(SINGLE_TRADE_PROMPT_CHALLENGE_EVENT, payload);
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
