import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import {
  parseRoblosecurity,
  setRoblosecurityPrefix,
} from "roblox-util/roblosecurity";
import { ProxyType, type ClientRequestConfig } from "roblox-proxy-core/types";
import { generateClientId, encodeSession } from "roblox-proxy-core/sessions";
import { AuthTicketApi } from "roblox-proxy-nestjs/apis/auth_ticket.api";
import { UsersApi } from "roblox-proxy-nestjs/apis/users.api";

import { LocatorService } from "./locator.service.js";

export interface LinkPayload {
  roblosecurity: string;
  roblosecurityIp: string;
}

const testnet = process.env.TESTNET === "true";

@Injectable()
export class LinkService {
  static DEFAULT_PROXY_TYPE = ProxyType.Residential;

  private readonly logger = new Logger(LinkService.name);

  constructor(
    private readonly locatorService: LocatorService,
    private readonly authTicketApi: AuthTicketApi,
    private readonly usersApi: UsersApi
  ) {}

  async link({ roblosecurity, roblosecurityIp }: LinkPayload) {
    const clientId = generateClientId(`cid=Roblosecurity,${roblosecurity}`);
    const { countryCode, stateOrRegion, cityOrProvince } =
      await this.locatorService.locate(roblosecurityIp);
    this.logger.debug(
      `Linking ${clientId}: ${countryCode ?? "n/a"}, ${
        stateOrRegion ?? "n/a"
      }, ${cityOrProvince ?? "n/a"}`
    );
    if (!testnet) {
      try {
        // Step 1. Prepare the request config and roblosecurity.
        const requestConfig: ClientRequestConfig = {
          clientId,
          proxyType: LinkService.DEFAULT_PROXY_TYPE,
          proxyLocation: {
            countryCode,
            stateOrRegion,
            cityOrProvince,
          },
        };
        const encodedSession = encodeSession(
          clientId,
          countryCode,
          stateOrRegion,
          cityOrProvince
        );
        roblosecurity = setRoblosecurityPrefix(roblosecurity, encodedSession);

        // Step 2. Create the auth ticket.
        this.logger.debug(`Creating auth ticket for ${clientId}...`);
        const authTicket = await this.authTicketApi.createTicket(
          roblosecurity,
          requestConfig
        );
        if (!authTicket) {
          throw new BadRequestException("Something went wrong (1).");
        }
        this.logger.debug(
          `Got auth ticket for ${clientId}: ${authTicket.slice(-8)}...`
        );

        // Step 3. Redeem the auth ticket.
        const cookies = await this.authTicketApi.redeemTicket(
          authTicket,
          requestConfig
        );
        if (!cookies) {
          throw new BadRequestException("Something went wrong (2).");
        }
        this.logger.debug(`Redeemed auth ticket for ${clientId}.`);

        // Step 4. Finalize the roblosecurity.
        const parsedRoblosecurity = parseRoblosecurity(cookies.toString());
        if (!parsedRoblosecurity) {
          throw new BadRequestException("Something went wrong (3).");
        }
        roblosecurity = setRoblosecurityPrefix(
          parsedRoblosecurity,
          encodedSession
        );
      } catch (error) {
        this.logger.error(
          `Failed to link ${clientId}: ${(error as Error).message}`
        );
        throw new BadRequestException("An error occurred, please try again.");
      }
    }
    const user = await this.usersApi.getAuthenticatedUser(roblosecurity);
    return { ok: true, user, roblosecurity };
  }
}
