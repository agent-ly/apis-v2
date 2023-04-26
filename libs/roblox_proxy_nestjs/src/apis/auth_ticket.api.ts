import { Injectable } from "@nestjs/common";
import type { RequestConfig } from "roblox-proxy-core/types";

import { RobloxClient } from "../roblox.client.js";

@Injectable()
export class AuthTicketApi {
  constructor(private readonly client: RobloxClient) {}

  async createTicket(
    roblosecurity: string,
    config?: RequestConfig
  ): Promise<string | null> {
    const url = "https://auth.roblox.com/v1/authentication-ticket";
    const init = { roblosecurity, method: "POST" };
    const response = await this.client.request(url, init, config);
    return response.headers.get("rbx-authentication-ticket");
  }

  async redeemTicket(
    ticket: string,
    config?: RequestConfig
  ): Promise<string | null> {
    const url = "https://auth.roblox.com/v1/authentication-ticket/redeem";
    const headers = { RBXAuthenticationNegotiation: "https://roblox.com" };
    const data = { authenticationTicket: ticket };
    const init = { method: "POST", headers, data };
    const response = await this.client.request(url, init, config);
    return response.headers.get("set-cookie");
  }
}
