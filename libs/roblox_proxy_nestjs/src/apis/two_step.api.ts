import { Injectable } from "@nestjs/common";

import { RobloxClient } from "../roblox.client.js";

export type MediaType = "email" | "sms" | "authenticator";

export type RblxChallengeType =
  | "forceauthenticator"
  | "twostepverification"
  | "reauthentication";

export interface RblxChallengeHeaders extends Record<string, any> {
  "rblx-challenge-id": string;
  "rblx-challenge-type": string;
  "rblx-challenge-metadata": string;
}

export interface RblxChallenge {
  challengeId: string;
  challengeType: string;
  challengeMetadata: string;
}

export interface GetMetadataQuery {
  userId: number;
  challengeId: string;
  actionType: string;
}

export interface GetMetadataResponse {
  twoStepVerificationEnabled: boolean;
}

export interface GetUserConfigurationParams {
  userId: number;
}

export interface GetUserConfigurationQuery {
  challengeId: string;
  actionType: string;
}

export interface UserConfigurationMethod {
  mediaType: string;
  enabled: boolean;
}

export interface GetUserConfigurationResponse {
  primaryMediaType: string;
  methods: UserConfigurationMethod[];
}

export interface VerifyCodeQuery {
  userId: number;
  mediaType: MediaType;
}

export interface VerifyCodePayload {
  challengeId?: string;
  actionType?: string;
  code: string;
}

export interface VerifyCodeResponse {
  verificationToken: string;
}

export interface EnableConfigurationParams {
  userId: number;
  mediaType: MediaType;
}

export interface EnableConfigurationPayload {
  password: string;
}

export interface DisableConfigurationParams {
  userId: number;
  mediaType: MediaType;
}

export interface EnableAuthenticatorResponse {
  manualEntryKey: string;
  qrCodeImageUrl: string;
  setupToken: string;
}

export interface VerifyEnableAuthenticatorPayload {
  setupToken: string;
  code: string;
  password: string;
}

export interface VerifyEnableAuthenticatorResponse {
  recoveryCodes: string[];
}

@Injectable()
export class TwoStepApi {
  constructor(private readonly client: RobloxClient) {}

  getMetadata({ userId, challengeId, actionType }: GetMetadataQuery) {
    const url = `https://twostepverification.roblox.com/v1/metadata?userId=${userId}&challengeId=${challengeId}&actionType=${actionType}`;
    return this.client.json<GetMetadataResponse>(url);
  }

  getConfiguration(
    { userId }: GetUserConfigurationParams,
    { challengeId, actionType }: GetUserConfigurationQuery
  ): Promise<GetUserConfigurationResponse> {
    let url = `https://twostepverification.roblox.com/v1/users/${userId}/configuration`;
    if (challengeId && actionType) {
      url += `?challengeId=${challengeId}&actionType=${actionType}`;
    }
    return this.client.json<GetUserConfigurationResponse>(url);
  }

  disableConfiguration(
    roblosecurity: string,
    { userId, mediaType }: DisableConfigurationParams,
    headers?: Record<string, string>
  ) {
    const url = `https://twostepverification.roblox.com/v1/users/${userId}/configuration/${mediaType}/disable`;
    const init = { roblosecurity, method: "POST", headers };
    return this.client.json<{}>(url, init);
  }

  verifyCode(
    { userId, mediaType }: VerifyCodeQuery,
    data: VerifyCodePayload
  ): Promise<VerifyCodeResponse> {
    const url = `https://twostepverification.roblox.com/v1/users/${userId}/challenges/${mediaType}/verify`;
    const init = { method: "POST", data };
    return this.client.json<VerifyCodeResponse>(url, init);
  }

  enableAuthenticator(
    roblosecurity: string,
    userId: number,
    data: EnableConfigurationPayload,
    headers?: Record<string, string>
  ): Promise<EnableAuthenticatorResponse> {
    const url = `https://twostepverification.roblox.com/v1/users/${userId}/configuration/authenticator/enable`;
    const init = { roblosecurity, method: "POST", headers, data };
    return this.client.json<EnableAuthenticatorResponse>(url, init);
  }

  verifyEnableAuthenticator(
    roblosecurity: string,
    userId: number,
    data: VerifyEnableAuthenticatorPayload
  ): Promise<VerifyEnableAuthenticatorResponse> {
    const url = `https://twostepverification.roblox.com/v1/users/${userId}/configuration/authenticator/enable-verify`;
    const init = { roblosecurity, method: "POST", data };
    return this.client.json<VerifyEnableAuthenticatorResponse>(url, init);
  }

  getRblxChallengeHeaders(headers: Headers): RblxChallengeHeaders {
    return {
      "rblx-challenge-id": headers.get("rblx-challenge-id") || "",
      "rblx-challenge-type": headers.get("rblx-challenge-type") || "",
      "rblx-challenge-metadata": headers.get("rblx-challenge-metadata") || "",
    };
  }

  parseRblxChallengeHeaders(headers: RblxChallengeHeaders): RblxChallenge {
    const {
      "rblx-challenge-id": challengeId,
      "rblx-challenge-type": challengeType,
      "rblx-challenge-metadata": challengeMetadata,
    } = headers;
    return { challengeId, challengeType, challengeMetadata };
  }

  parseRblxChallengeMetadata(challengeMetadata: string): string {
    return JSON.parse(
      Buffer.from(challengeMetadata, "base64").toString("utf-8")
    );
  }
}
