import { Inject, Injectable } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";

import robloxConfig from "./roblox.config.js";
import type {
  AddMultiTradePayload,
  CanAuthenticatedUserTradeResponse,
  GetAuthenticatedUserResponse,
  GetUserCollectiblesResponse,
  MultiTrade,
} from "./roblox.interfaces.js";

@Injectable()
export class RobloxService {
  constructor(
    @Inject(robloxConfig.KEY)
    private readonly config: ConfigType<typeof robloxConfig>,
    private readonly eventEmitter: EventEmitter2
  ) {}

  async getUserCollectibles(
    userId: number
  ): Promise<GetUserCollectiblesResponse> {
    const response = await this.fetch("core", `/users/${userId}/collectibles`);
    if (!response.ok) {
      return { ok: false, error: "unknown" };
    }
    const body = await response.json();
    return { ok: true, data: body };
  }

  async getAuthenticatedUser(
    roblosecurity: string
  ): Promise<GetAuthenticatedUserResponse> {
    const response = await this.fetch("core", "/users/authenticated", {
      headers: { "X-Roblosecurity": roblosecurity },
    });
    if (!response.ok) {
      return { ok: false, error: "unauthorized" };
    }
    const body = await response.json();
    return { ok: true, data: body };
  }

  async canAuthenticatedUserTrade(
    roblosecurity: string
  ): Promise<CanAuthenticatedUserTradeResponse> {
    const response = await this.fetch(
      "core",
      "/users/authenticated/can-trade",
      {
        headers: { "X-Roblosecurity": roblosecurity },
      }
    );
    if (!response.ok) {
      const [error, message] =
        response.status === 401 ? ["unauthorized", ""] : ["unknown", ""];
      return { ok: false, error, message };
    }
    const body = await response.json();
    return body;
  }

  async addMultiTrade(payload: AddMultiTradePayload): Promise<string | null> {
    const response = await this.fetch("trades", "/queue/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      return null;
    }
    const body = await response.text();
    return body;
  }

  async getMultiTrade(multiTradeId: string): Promise<MultiTrade | null> {
    const response = await this.fetch(
      "trades",
      `/multi-trades/${multiTradeId}`
    );
    if (!response.ok) {
      return null;
    }
    const body = await response.json();
    return body;
  }

  async acknowledgeMultiTrade(multiTradeId: string): Promise<boolean> {
    const response = await this.fetch(
      "trades",
      `/multi-trades/${multiTradeId}/acknowledge`,
      { method: "POST" }
    );
    return response.ok;
  }

  private fetch(
    server: "core" | "trades",
    url: string,
    options?: RequestInit
  ): Promise<Response> {
    const baseUrl =
      server === "core" ? this.config.coreUrl : this.config.tradesUrl;
    return fetch(`${baseUrl}${url}`, options);
  }
}
