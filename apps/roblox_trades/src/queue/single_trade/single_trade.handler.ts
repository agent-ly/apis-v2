import { Injectable, Logger } from "@nestjs/common";
import {
  RobloxApiError,
  type NormalizedRobloxApiError,
} from "roblox-proxy-nestjs";
import {
  TradesApi,
  type TradeOfferPayload,
  type TradeStatus,
} from "roblox-proxy-nestjs/apis/trades.api";
import { TwoStepApi } from "roblox-proxy-nestjs/apis/two_step.api";
import { Result } from "errd/result";
import totp from "totp-generator";

@Injectable()
export class SingleTradeHandler {
  private readonly logger = new Logger(SingleTradeHandler.name);

  constructor(
    private readonly tradesApi: TradesApi,
    private readonly twoStepApi: TwoStepApi
  ) {}

  async trySendTrade({
    userId,
    roblosecurity,
    totpSecret,
    offer,
    receive,
    headers,
  }: TrySendTradePayload): Promise<number> {
    const data = { offers: [offer, receive] };
    const result = await Result.fromAsync(() =>
      this.tradesApi.sendTrade(roblosecurity, data, headers)
    );
    if (result.isErr()) {
      const error = await RobloxApiError.toNormalized(result.unwrapErr());
      const details = this.handleNormalizedError({ userId, error });
      error.name = "TradeSendError";
      if (!details.handled) {
        if (error.statusCode === 400 && error.errorCode === 12) {
          error.message = "An item is no longer available to trade.";
        } else if (error.statusCode === 429 && error.errorCode === 14) {
          error.message =
            "Your account has sent too many trades recently, please try again later.";
          error.field = "userId";
          error.fieldData = userId;
        }
      } else if (totpSecret && this.isTwoStepVerificationError(details)) {
        return this.withTwoStepVerificationError(
          {
            userId,
            roblosecurity,
            totpSecret,
            error,
            details,
          },
          (headers) =>
            this.trySendTrade({
              userId,
              roblosecurity,
              totpSecret,
              offer,
              receive,
              headers,
            })
        );
      }
      throw error;
    }
    const { id: tradeId } = result.unwrap();
    this.logger.debug(`Sent Trade ${tradeId} as User ${userId}.`);
    return tradeId;
  }

  async tryAcceptTrade({
    userId,
    tradeId,
    roblosecurity,
    totpSecret,
    headers,
  }: TryAcceptTradePayload): Promise<TradeStatus> {
    const result = await Result.fromAsync(() =>
      this.tradesApi.acceptTrade(roblosecurity, tradeId, headers)
    );
    if (result.isErr()) {
      const error = await RobloxApiError.toNormalized(result.unwrapErr());
      const details = this.handleNormalizedError({ userId, error });
      if (!details.handled) {
        if (error.statusCode === 400 && error.errorCode === 3) {
          const { status } = await this.tryGetTrade(roblosecurity, tradeId);
          if (status === "Completed" || status === "InterventionRequired") {
            this.logger.debug(`Trade ${tradeId} is already completed.`);
            return status;
          }
          error.message = `Trade is no longer active: ${status}`;
        }
      } else if (totpSecret && this.isTwoStepVerificationError(details)) {
        return this.withTwoStepVerificationError(
          {
            userId,
            roblosecurity,
            totpSecret,
            error,
            details,
          },
          (headers) =>
            this.tryAcceptTrade({
              userId,
              tradeId,
              roblosecurity,
              totpSecret,
              headers,
            })
        );
      }
      error.name = "TradeAcceptError";
      throw error;
    }
    this.logger.debug(`Accepted Trade ${tradeId} as User ${userId}.`);
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
      const error = await RobloxApiError.toNormalized(result.unwrapErr());
      this.logger.error(`Failed to get Trade ${tradeId}: ${error.message}`);
      return { isActive: false, status: "Unknown" };
    }
    const trade = result.unwrap();
    return { isActive: trade.isActive, status: trade.status };
  }

  async tryDeclineTrade(roblosecurity: string, tradeId: number): Promise<void> {
    const result = await Result.fromAsync(() =>
      this.tradesApi.declineTrade(roblosecurity, tradeId)
    );
    if (result.isErr()) {
      const error = await RobloxApiError.toNormalized(result.unwrapErr());
      this.logger.error(`Failed to decline Trade ${tradeId}: ${error.message}`);
    } else {
      this.logger.debug(`Declined Trade ${tradeId}.`);
    }
  }

  async trySolveTradeFriction(
    payload: TrySolveTradeFrictionPayload
  ): Promise<boolean> {
    try {
      this.logger.debug(`Solving trade triction for User ${payload.userId}...`);
      const challengeId = await this.tradesApi.generateTwoStepChallenge(
        payload.roblosecurity
      );
      const code = totp(payload.totpSecret);
      const { verificationToken } = await this.twoStepApi.verifyCode(
        {
          userId: payload.userId,
          mediaType: "authenticator",
        },
        {
          actionType: "ItemTrade",
          challengeId,
          code,
        }
      );
      await this.tradesApi.redeemTwoStepChallenge(payload.roblosecurity, {
        challengeToken: challengeId,
        verificationToken,
      });
      this.logger.debug(`Solved trade triction for User ${payload.userId}.`);
      return true;
    } catch (error) {
      let message = (error as Error).message;
      if (error instanceof RobloxApiError) {
        const normalized = await RobloxApiError.toNormalized(error);
        error = normalized.message;
      }
      this.logger.debug(
        `Failed to solve trade triction for User ${payload.userId}: ${message}`
      );
      return false;
    }
  }

  async trySolveTradeTwoStepVerification(
    payload: TrySolveTradeTwoStepVerificationPayload
  ): Promise<Record<string, any> | false> {
    try {
      const rblxChallengeId = payload.headers["rbx-challenge-id"],
        rblxChallengeType = payload.headers["rbx-challenge-type"];
      let rblxChallengeMetadata = JSON.parse(
        Buffer.from(
          payload.headers["rblx-challenge-metadata"],
          "base64"
        ).toString("utf8")
      );
      const { challengeId, actionType } = rblxChallengeMetadata;
      const code = totp(payload.totpSecret);
      const { verificationToken } = await this.twoStepApi.verifyCode(
        {
          userId: payload.userId,
          mediaType: "authenticator",
        },
        {
          actionType,
          challengeId,
          code,
        }
      );
      rblxChallengeMetadata = Buffer.from(
        JSON.stringify({
          verificationToken,
          challengeId,
          actionType,
        })
      ).toString("base64");
      return {
        "rblx-challenge-id": rblxChallengeId,
        "rblx-challenge-type": rblxChallengeType,
        "rblx-challenge-metadata": rblxChallengeMetadata,
      };
    } catch (error) {
      return false;
    }
  }

  isTwoStepVerificationError(details: HandledNormalizedErrorDetails): boolean {
    return (
      details.isTwoStepVerificationExpired ||
      details.isTwoStepVerificationRequired
    );
  }

  async withTwoStepVerificationError<T>(
    {
      userId,
      roblosecurity,
      totpSecret,
      error,
      details,
    }: WithTwoStepVerificationArgs,
    callback: (headers?: Record<string, any>) => Promise<T>
  ): Promise<T> {
    const result = await this.handleTwoStepVerificationError({
      userId,
      roblosecurity,
      totpSecret,
      error,
      details,
    });
    if (result !== false) {
      const headers = typeof result === "object" ? result : undefined;
      return callback(headers);
    }
    throw error;
  }

  async handleTwoStepVerificationError({
    userId,
    roblosecurity,
    totpSecret,
    error,
    details,
  }: HandleTwoStepVerificationErrorArgs) {
    const result = details.isTwoStepVerificationExpired
      ? await this.trySolveTradeFriction({
          userId,
          roblosecurity,
          totpSecret,
        })
      : details.isTwoStepVerificationRequired && error.headers
      ? await this.trySolveTradeTwoStepVerification({
          userId,
          roblosecurity,
          totpSecret,
          headers: error.headers,
        })
      : false;
    return result;
  }

  handleNormalizedError({
    userId,
    error,
  }: HandleNormalizedErrorArgs): HandledNormalizedErrorDetails {
    const isServerError = error.statusCode >= 500;
    const isAuthenticationInvalid =
      error.statusCode === 401 &&
      (error.errorCode === 0 || error.errorCode === 9002);
    const isTwoStepVerificationExpired =
      error.statusCode === 400 && error.errorCode === 23;
    const [isTwoStepVerificationRequired, isAuthenticatorRequired] =
      (error.statusCode === 403 &&
        error.errorCode === 0 &&
        error.headers != undefined && [
          error.headers["rbx-challenge-type"] === "twostepverification",
          error.headers["rbx-challenge-type"] === "forceauthenticator",
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

    const handled =
      isServerError ||
      isAuthenticationInvalid ||
      isTwoStepVerificationExpired ||
      isTwoStepVerificationRequired ||
      isAuthenticatorRequired;

    return {
      handled,
      isServerError,
      isAuthenticationInvalid,
      isTwoStepVerificationExpired,
      isTwoStepVerificationRequired,
      isAuthenticatorRequired,
    };
  }
}

interface HandleNormalizedErrorArgs {
  userId: number;
  error: NormalizedRobloxApiError;
}

interface HandledNormalizedErrorDetails {
  handled: boolean;
  isServerError: boolean;
  isAuthenticationInvalid: boolean;
  isTwoStepVerificationExpired: boolean;
  isTwoStepVerificationRequired: boolean;
  isAuthenticatorRequired: boolean;
}

interface HandleTwoStepVerificationErrorArgs {
  userId: number;
  roblosecurity: string;
  totpSecret: string;
  error: NormalizedRobloxApiError;
  details: HandledNormalizedErrorDetails;
}

interface WithTwoStepVerificationArgs {
  userId: number;
  roblosecurity: string;
  totpSecret: string;
  error: NormalizedRobloxApiError;
  details: HandledNormalizedErrorDetails;
}

interface TrySendTradePayload {
  userId: number;
  roblosecurity: string;
  totpSecret?: string;
  totpCode?: string;
  offer: TradeOfferPayload;
  receive: TradeOfferPayload;
  headers?: Record<string, any>;
}

interface TryAcceptTradePayload {
  tradeId: number;
  userId: number;
  roblosecurity: string;
  totpSecret?: string;
  totpCode?: string;
  headers?: Record<string, any>;
}

interface TryGetTradeResult {
  isActive: boolean;
  status: TradeStatus;
}

interface TrySolveTradeFrictionPayload {
  userId: number;
  roblosecurity: string;
  totpSecret: string;
}

interface TrySolveTradeTwoStepVerificationPayload {
  userId: number;
  roblosecurity: string;
  totpSecret: string;
  headers: Record<string, any>;
}
