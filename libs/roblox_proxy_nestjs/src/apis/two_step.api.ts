import { Injectable } from "@nestjs/common";

import { RobloxClient } from "../roblox.client.js";

export type ActionType =
  | "Unknown"
  | "Login"
  | "RobuxSpend"
  | "ItemTrade"
  | "Resale"
  | "PasswordReset"
  | "RevertAccount"
  | "Generic"
  | "GenericWithRecoveryCodes";

export interface GetMetadataQuery {
  userId: number;
  challengeId: string;
  actionType: ActionType;
}

export interface GetMetadataResponse {
  twoStepVerificationEnabled: boolean;
}

export interface GetUserConfigurationQuery {
  challengeId: string;
  actionType: ActionType;
}

export type MediaType =
  | "Email"
  | "SMS"
  | "Authenticator"
  | "RecoveryCode"
  | "SecurityKey";

export interface UserConfigurationMethod {
  mediaType: MediaType;
  enabled: boolean;
}

export interface GetUserConfigurationResponse {
  primaryMediaType: MediaType;
  methods: UserConfigurationMethod[];
}

export interface VerifyCodeParams {
  userId: number;
  mediaType: "email" | "sms" | "authenticator" | "recovery-codes";
}

export interface VerifyCodePayload {
  challengeId?: string;
  actionType?: ActionType;
  code: string;
}

export interface VerifyCodeResponse {
  verificationToken: string;
}

export interface EnableConfigurationParams {
  userId: number;
  mediaType: "email" | "sms" | "authenticator" | "security-key";
}

export interface EnableConfigurationPayload {
  password: string;
}

export interface DisableConfigurationParams {
  userId: number;
  mediaType: "email" | "sms" | "authenticator" | "security-key";
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

export interface Challenge {
  id: string;
  type: string;
  metadata: string;
}

@Injectable()
export class TwoStepApi {
  constructor(private readonly client: RobloxClient) {}

  getMetadata({ userId, challengeId, actionType }: GetMetadataQuery) {
    const url = `https://twostepverification.roblox.com/v1/metadata?userId=${userId}&challengeId=${challengeId}&actionType=${actionType}`;
    return this.client.json<GetMetadataResponse>(url);
  }

  getConfiguration(
    userId: number,
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
    { userId, mediaType }: VerifyCodeParams,
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

  getChallenge(headers: Record<string, any>): Challenge | null {
    const challengeId = headers["rblx-challenge-id"];
    const challengeType = headers["rblx-challenge-type"];
    const challengeMetadata = headers["rblx-challenge-metadata"];
    if (!challengeId || !challengeType || !challengeMetadata) {
      return null;
    }
    return {
      id: challengeId,
      type: challengeType,
      metadata: challengeMetadata,
    };
  }

  setChallenge(challenge: Challenge, headers: Record<string, any>): void {
    headers["rblx-challenge-id"] = challenge.id;
    headers["rblx-challenge-type"] = challenge.type;
    headers["rblx-challenge-metadata"] = challenge.metadata;
  }

  encodeChallengeMetadata(metadata: Record<string, any>): string {
    return Buffer.from(JSON.stringify(metadata)).toString("base64");
  }

  decodeChallengeMetadata(metadata: string): Record<string, any> {
    return JSON.parse(Buffer.from(metadata, "base64").toString("utf-8"));
  }
}
