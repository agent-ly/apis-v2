import { Injectable, Logger } from "@nestjs/common";
import { RobloxErrorHost, type RobloxError } from "roblox-proxy-nestjs";
import {
  TradesApi,
  type TradeOfferPayload,
  type TradeStatus,
} from "roblox-proxy-nestjs/apis/trades.api";
import { TwoStepApi } from "roblox-proxy-nestjs/apis/two_step.api";
import { Result } from "errd";
import { totp } from "node-totp-generator";

import type { SingleTradeUser } from "./single_trade.entity.js";

@Injectable()
export class SingleTradeHandler {
  private readonly logger = new Logger(SingleTradeHandler.name);

  constructor(
    private readonly tradesApi: TradesApi,
    private readonly twoStepApi: TwoStepApi
  ) {}

  async trySendTrade({
    user,
    offer,
    receive,
  }: TrySendTradePayload): Promise<number> {
    const headers = await this.trySolveChallenge(user);
    const data = { offers: [offer, receive] };
    const result = await Result.fromAsync(() =>
      this.tradesApi.sendTrade(user.credentials!.roblosecurity, data, headers)
    );
    if (result.isErr()) {
      const error = await RobloxErrorHost.normalize(result.unwrapErr());
      error.name = "TradeSendError";
      const handled = this.handleError(user.id, error);
      if (!handled.isHandled) {
        if (error.statusCode === 400 && error.errorCode === 12) {
          error.message = "An item is no longer available to trade.";
        } else if (error.statusCode === 429 && error.errorCode === 14) {
          error.message =
            "Your account has sent too many trades recently, please try again later.";
          error.field = "userId";
          error.fieldData = user.id;
        }
      } else if (this.hasChallenge(handled)) {
        this.setChallenge(user, error, handled);
        if (user.totp?.secret) {
          return this.trySendTrade({ user, offer, receive });
        }
      }
      throw error;
    }
    const { id: tradeId } = result.unwrap();
    this.logger.debug(`Sent Trade ${tradeId} as User ${user.id}.`);
    return tradeId;
  }

  async tryAcceptTrade({
    user,
    tradeId,
  }: TryAcceptTradePayload): Promise<TradeStatus> {
    const headers = await this.trySolveChallenge(user);
    const result = await Result.fromAsync(() =>
      this.tradesApi.acceptTrade(
        user.credentials!.roblosecurity,
        tradeId,
        headers
      )
    );
    if (result.isErr()) {
      const error = await RobloxErrorHost.normalize(result.unwrapErr());
      error.name = "TradeAcceptError";
      const handled = this.handleError(user.id, error);
      if (!handled.isHandled) {
        if (error.statusCode === 400 && error.errorCode === 3) {
          const { status } = await this.tryGetTrade(
            user.credentials!.roblosecurity,
            tradeId
          );
          if (status === "Completed" || status === "InterventionRequired") {
            this.logger.debug(`Trade ${tradeId} is already completed.`);
            return status;
          }
          error.message = `Trade is no longer active: ${status}`;
        }
      } else if (this.hasChallenge(handled)) {
        this.setChallenge(user, error, handled);
        if (user.totp?.secret) {
          return this.tryAcceptTrade({ user, tradeId });
        }
      }
      throw error;
    }
    this.logger.debug(`Accepted Trade ${tradeId} as User ${user.id}.`);
    return "Processing";
  }

  async tryGetTrade(
    roblosecurity: string,
    tradeId: number
  ): Promise<TryGetTradeResult> {
    const result = await Result.fromAsync(() =>
      this.tradesApi.getTrade(roblosecurity, tradeId)
    );
    if (result.isErr()) {
      return { isActive: false, status: "Unknown" };
    }
    const trade = result.unwrap();
    return { isActive: trade.isActive, status: trade.status };
  }

  async tryDeclineTrade(
    roblosecurity: string,
    tradeId: number
  ): Promise<boolean> {
    const result = await Result.fromAsync(() =>
      this.tradesApi.declineTrade(roblosecurity, tradeId)
    );
    return result.isOk();
  }

  async trySolveChallenge(
    user: SingleTradeUser
  ): Promise<Record<string, any> | undefined> {
    let headers: Record<string, any> | undefined;
    if (user.totp && user.challenge) {
      if (!user.totp.code && user.totp.secret) {
        user.totp.code = totp(user.totp.secret);
      }
      if (user.totp.code) {
        if (user.challenge.type === "twostepverification") {
          headers = await this.trySolveTwoStepVerificationChallenge({
            userId: user.id,
            roblosecurity: user.credentials!.roblosecurity,
            code: user.totp.code,
            challengeId: user.challenge.id,
            challengeType: user.challenge.type,
            challengeMetadata: user.challenge.metadata,
          });
        } else if (user.challenge.type === "twostepverificationexpired") {
          await this.trySolveTradeFrictionChallenge({
            userId: user.id,
            roblosecurity: user.credentials!.roblosecurity,
            code: user.totp.code,
          });
        } else {
          throw new Error(`Unknown challenge type: ${user.challenge.type}`);
        }
        user.totp = undefined;
        user.challenge = undefined;
      }
    }
    return headers;
  }

  async trySolveTradeFrictionChallenge(
    payload: TrySolveTradeFrictionPayload
  ): Promise<boolean> {
    try {
      const challengeId = await this.tradesApi.generateTwoStepChallenge(
        payload.roblosecurity
      );
      const { verificationToken } = await this.twoStepApi.verifyCode(
        {
          userId: payload.userId,
          mediaType: "authenticator",
        },
        {
          actionType: "ItemTrade",
          challengeId,
          code: payload.code,
        }
      );
      await this.tradesApi.redeemTwoStepChallenge(payload.roblosecurity, {
        challengeToken: challengeId,
        verificationToken,
      });
      return true;
    } catch (error) {
      if (error instanceof RobloxErrorHost) {
        console.dir(await error.normalize(), { depth: null });
      }
      return false;
    }
  }

  async trySolveTwoStepVerificationChallenge(
    payload: TrySolveTradeTwoStepVerificationPayload
  ): Promise<Record<string, any> | undefined> {
    try {
      const { challengeId, actionType } =
        this.twoStepApi.decodeChallengeMetadata(payload.challengeMetadata);
      const { verificationToken } = await this.twoStepApi.verifyCode(
        { userId: payload.userId, mediaType: "authenticator" },
        { actionType, challengeId, code: payload.code }
      );
      const challengeMetadata = this.twoStepApi.encodeChallengeMetadata({
        verificationToken,
        challengeId,
        actionType,
      });
      return {
        "rblx-challenge-id": payload.challengeId,
        "rblx-challenge-type": payload.challengeId,
        "rblx-challenge-metadata": challengeMetadata,
      };
    } catch (error) {
      if (error instanceof RobloxErrorHost) {
        console.dir(await error.normalize(), { depth: null });
      }
    }
  }

  setChallenge(
    user: SingleTradeUser,
    error: RobloxError,
    result: HandleErrorResult
  ): void {
    if (result.isTwoStepVerificationExpired) {
      const challenge = { type: "twostepverificationexpired" };
      user.challenge = challenge;
    } else if (result.isTwoStepVerificationRequired && error.headers) {
      const challenge = this.twoStepApi.getChallenge(error.headers);
      if (challenge) {
        user.challenge = challenge;
      }
    }
    if (user.challenge) {
      error.name = "TradeChallengeError";
    }
  }

  hasChallenge(result: HandleErrorResult): boolean {
    return (
      result.isTwoStepVerificationExpired ||
      result.isTwoStepVerificationRequired
    );
  }

  handleError(userId: number, error: RobloxError): HandleErrorResult {
    const isServerError = error.statusCode >= 500;
    const isAuthenticationInvalid =
      error.statusCode === 401 &&
      (error.errorCode === 0 || error.errorCode === 9002);
    const isTwoStepVerificationExpired =
      error.statusCode === 400 && error.errorCode === 23;
    const [isTwoStepVerificationRequired, isAuthenticatorRequired] =
      (error.statusCode === 403 &&
        error.headers != undefined && [
          error.headers["rblx-challenge-type"] === "twostepverification",
          error.headers["rblx-challenge-type"] === "forceauthenticator",
        ]) || [false, false];

    if (isServerError) {
      error.message = "Server unavailable.";
    } else if (isAuthenticationInvalid) {
      error.message = "Your authentication is invalid.";
    } else if (isTwoStepVerificationExpired) {
      error.message =
        "You have not completed two-step verification in the past-time threshold.";
    } else if (isTwoStepVerificationRequired) {
      error.message = "You must complete two-step verification.";
    } else if (isAuthenticatorRequired) {
      error.message =
        "You must enable two-step verification with an authenticator app.";
    }

    if (
      isAuthenticationInvalid ||
      isTwoStepVerificationExpired ||
      isTwoStepVerificationRequired ||
      isAuthenticatorRequired
    ) {
      error.field = "userId";
      error.fieldData = userId;
    }

    const isHandled =
      isServerError ||
      isAuthenticationInvalid ||
      isTwoStepVerificationExpired ||
      isTwoStepVerificationRequired ||
      isAuthenticatorRequired;

    return {
      isHandled,
      isServerError,
      isAuthenticationInvalid,
      isTwoStepVerificationExpired,
      isTwoStepVerificationRequired,
      isAuthenticatorRequired,
    };
  }
}

interface TrySendTradePayload {
  user: SingleTradeUser;
  offer: TradeOfferPayload;
  receive: TradeOfferPayload;
}

interface TryAcceptTradePayload {
  user: SingleTradeUser;
  tradeId: number;
}

interface TryGetTradeResult {
  isActive: boolean;
  status: TradeStatus;
}

interface TrySolveTradeFrictionPayload {
  userId: number;
  roblosecurity: string;
  code: string;
}

interface TrySolveTradeTwoStepVerificationPayload {
  userId: number;
  roblosecurity: string;
  code: string;
  challengeId: string;
  challengeType: string;
  challengeMetadata: string;
}

interface HandleErrorResult {
  isHandled: boolean;
  isServerError: boolean;
  isAuthenticationInvalid: boolean;
  isTwoStepVerificationExpired: boolean;
  isTwoStepVerificationRequired: boolean;
  isAuthenticatorRequired: boolean;
}
