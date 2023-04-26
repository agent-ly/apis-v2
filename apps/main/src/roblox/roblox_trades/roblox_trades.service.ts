import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { WebSocket } from "ws";

import robloxConfig from "../roblox.config.js";
import type {
  StartMultiTradePayload,
  MultiTrade,
} from "./roblox_trades.interfaces.js";
import { MultiTradeProcessedEvent } from "./events/multi_trade_processed.event.js";

@Injectable()
export class RobloxTradesService implements OnModuleInit {
  private readonly logger = new Logger(RobloxTradesService.name);

  constructor(
    @Inject(robloxConfig.KEY)
    private readonly config: ConfigType<typeof robloxConfig>,
    private readonly eventEmitter: EventEmitter2
  ) {}

  onModuleInit(): void {
    this.startListener();
  }

  startListener(): void {
    const ws = new WebSocket(this.config.tradesWsUrl);
    ws.on("message", async (data) => {
      const message = JSON.parse(data.toString());
      this.logger.log(`Received trades websocket message: ${message.event}`);
      if (message.event === MultiTradeProcessedEvent.EVENT) {
        this.eventEmitter.emit(
          message.event,
          new MultiTradeProcessedEvent(message.data)
        );
      }
    });
    ws.on("open", () => this.logger.log("Connected to trades websocket."));
    ws.on("close", () =>
      this.logger.warn("Disconnected from trades websocket.")
    );
    ws.on("error", (error) =>
      this.logger.error(`Trades websocket error: ${error.message}`)
    );
  }

  async startMultiTrade(
    payload: StartMultiTradePayload
  ): Promise<string | null> {
    const response = await fetch(
      `${this.config.tradesUrl}/add-many-to-one-multi-trade`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    if (!response.ok) {
      return null;
    }
    const body = await response.text();
    return body;
  }

  async findUnacknowledgedMultiTrades(): Promise<MultiTrade[]> {
    const response = await fetch(
      `${this.config.tradesUrl}/multi-trades/unacknowledged`
    );
    if (!response.ok) {
      return [];
    }
    const body = await response.json();
    return body;
  }

  async findMultiTradeById(multiTradeId: string): Promise<MultiTrade | null> {
    const response = await fetch(
      `${this.config.tradesUrl}/multi-trades/${multiTradeId}`
    );
    if (!response.ok) {
      return null;
    }
    const body = await response.json();
    return body;
  }

  async acknowledgeMultiTrade(multiTradeId: string): Promise<boolean> {
    const response = await fetch(
      `${this.config.tradesUrl}/multi-trades/${multiTradeId}/acknowledge`,
      { method: "POST" }
    );
    return response.ok;
  }

  async solveSingleTradeChallenge(
    singleTradeId: string,
    userId: number,
    code?: string,
    secret?: string
  ): Promise<boolean> {
    let url = `${this.config.tradesUrl}/single-trades/${singleTradeId}/${userId}/solve-challenge`;
    const usp = new URLSearchParams();
    if (code) {
      usp.append("code", code);
    }
    if (secret) {
      usp.append("secret", secret);
    }
    url += "?" + usp.toString();
    const response = await fetch(url, { method: "POST" });
    return response.ok;
  }
}
