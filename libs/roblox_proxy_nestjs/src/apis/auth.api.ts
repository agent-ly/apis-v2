import { Injectable } from "@nestjs/common";
import type { RequestConfig } from "roblox-proxy-core/types";

import { RobloxClient } from "../roblox.client.js";

export interface LoginPayload {
  ctype:
    | "Email"
    | "Username"
    | "PhoneNumber"
    | "EmailOtpSessionToken"
    | "AuthToken";
  cvalue: string;
  password: string;
  userId?: number;
  securityQuestionSessionId?: string;
  securityQuestionRedemptionToken?: string;
  secureAuthenticationIntent?: {
    clientPublicKey: string;
    clientEpochTimestamp: number;
    saiSignature: string;
    serverNonce: string;
  };
  captchaId?: string;
  captchaToken?: string;
  captchaProvider?: string;
  challengeId?: string;
}

export interface LoginResponse {
  user: {
    id: number;
    name: string;
    displayName: string;
  };
  twoStepVerificationData?: {
    mediaType: string;
    ticket: string;
  };
  identityVerificationLoginTicket?: string;
  isBanned: boolean;
}

export interface TwoStepVerificationLoginPayload {
  challengeId: string;
  verificationToken: string;
  rememberDevice?: boolean;
}

export interface TwoStepVerificationLoginResponse {
  identityVerificationLoginTicket: string;
}

export interface SignupPayload {
  username: string;
  password: string;
  gender: string;
  birthday: string;
  isTosAgreementBoxChecked: boolean;
  agreementIds: string[];
  captchaId?: string;
  captchaToken?: string;
}

@Injectable()
export class AuthApi {
  constructor(private readonly client: RobloxClient) {}

  signup(data: SignupPayload, config?: RequestConfig): Promise<Response> {
    const url = "https://auth.roblox.com/v2/signup";
    const init = { method: "POST", data };
    return this.client.request(url, init, config);
  }

  login(
    data: LoginPayload,
    config?: RequestConfig,
    headers?: Record<string, any>
  ): Promise<Response> {
    const url = "https://auth.roblox.com/v2/login";
    const init = { method: "POST", headers, data };
    return this.client.request(url, init, config);
  }

  twoStepVerificationLogin(
    userId: number,
    data: TwoStepVerificationLoginPayload,
    config?: RequestConfig
  ): Promise<Response> {
    const url = `https://auth.roblox.com/v3/users/${userId}/two-step-verification/login`;
    const init = { method: "POST", data };
    return this.client.request(url, init, config);
  }
}
