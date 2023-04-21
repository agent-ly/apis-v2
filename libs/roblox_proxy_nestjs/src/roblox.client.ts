import { Injectable } from "@nestjs/common";
import { getRoblosecurityPrefix } from "roblox-util/roblosecurity";
import { isSession, decodeSession } from "roblox-proxy-core/sessions";
import { request, type RequestOptions } from "roblox-proxy-core/client";

import { RobloxErrorHost } from "./roblox.error-host.js";

@Injectable()
export class RobloxClient {
  async request(
    url: string,
    init?: RequestOptions["init"],
    config?: RequestOptions["config"]
  ): Promise<Response> {
    if (init?.roblosecurity) {
      const prefix = getRoblosecurityPrefix(init.roblosecurity);
      if (isSession(prefix)) {
        const session = decodeSession(prefix);
        if (!config) {
          config = {};
        }
        config.clientId = session.clientId;
        config.proxyLocation = session.proxyLocation;
      }
    }
    const response = await request(url, { init, config });
    if (!response.ok) {
      throw new RobloxErrorHost(response);
    }
    return response;
  }

  async json<TData = unknown>(
    url: string,
    init?: RequestOptions["init"],
    config?: RequestOptions["config"]
  ) {
    const response = await this.request(url, init, config);
    const data = await response.json();
    return data as TData;
  }
}
