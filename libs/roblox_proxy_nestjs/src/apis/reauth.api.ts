import { Injectable } from "@nestjs/common";

import { RobloxClient } from "../roblox.client.js";

export enum ReauthenticationError {
  UNKNOWN = 1,
  REQUEST_TYPE_WAS_INVALID = 2,
  PASSWORD_INCORRECT = 3,
}

export interface GenerateTokenPayload {
  password: string;
}

export interface GenerateTokenResponse {
  token: string;
}

@Injectable()
export class ReauthApi {
  constructor(private readonly client: RobloxClient) {}

  generateToken(
    roblosecurity: string,
    data: GenerateTokenPayload
  ): Promise<GenerateTokenResponse> {
    const url =
      "https://apis.roblox.com/reauthentication-service/v1/token/generate";
    const init = { roblosecurity, method: "POST", data };
    return this.client.json(url, init);
  }
}
