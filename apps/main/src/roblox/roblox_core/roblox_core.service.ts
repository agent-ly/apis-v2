import { Inject, Injectable } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";

import robloxConfig from "../roblox.config.js";
import type {
  CanAuthenticatedUserTradeResponse,
  GetAuthenticatedUserResponse,
  GetUserCollectiblesResponse,
} from "./roblox_core.interfaces.js";

@Injectable()
export class RobloxCoreService {
  constructor(
    @Inject(robloxConfig.KEY)
    private readonly config: ConfigType<typeof robloxConfig>
  ) {}

  async auth(init: RequestInit) {
    const response = await fetch(`${this.config.coreUrl}/auth/${init.url}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...init.headers,
      },
      body: JSON.stringify(init.body),
    });
    const body = await response.json();
    return {
      status: response.status,
      headers: response.headers,
      body,
    };
  }

  async getUserCollectibles(
    userId: number,
    cursor?: string
  ): Promise<GetUserCollectiblesResponse> {
    let url = `${this.config.coreUrl}/user/${userId}/inventory/collectibles`;
    if (cursor) {
      url += `?cursor=${cursor}`;
    }
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 403 || response.status >= 500) {
        return {
          ok: false,
          error:
            response.status === 403
              ? "inventory_not_public"
              : "internal_server_error",
        };
      }
      return { ok: true, data: { nextPageCursor: null, data: [] } };
    }
    const data = await response.json();
    return { ok: true, data };
  }

  async getAuthenticatedUser(
    roblosecurity: string
  ): Promise<GetAuthenticatedUserResponse> {
    const response = await fetch(`${this.config.coreUrl}/authenticated-user`, {
      headers: { "X-Roblosecurity": roblosecurity },
    });
    if (!response.ok) {
      return {
        ok: false,
        error:
          response.status === 401
            ? "unauthorized"
            : response.status === 403
            ? "moderated"
            : "internal_server_error",
      };
    }
    const data = await response.json();
    return { ok: true, data };
  }

  async canAuthenticatedUserTrade(
    roblosecurity: string
  ): Promise<CanAuthenticatedUserTradeResponse> {
    const response = await fetch(
      `${this.config.coreUrl}/authenticated-user/can-trade`,
      {
        headers: { "X-Roblosecurity": roblosecurity },
      }
    );
    if (response.status >= 500) {
      return {
        ok: false,
        error: "internal_server_error",
        message: "Internal server error. Please try again later.",
      };
    }
    const body = await response.json();
    return body;
  }
}

interface RequestInit {
  url: string;
  headers: Record<string, string>;
  body: Record<string, any>;
}
