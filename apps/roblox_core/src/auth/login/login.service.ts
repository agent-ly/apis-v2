import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import {
  parseRoblosecurity,
  setRoblosecurityPrefix,
} from "roblox-util/roblosecurity";
import { ProxyType } from "roblox-proxy-core/types";
import { generateClientId, encodeSession } from "roblox-proxy-core/sessions";
import { AccountSecurityApi } from "roblox-proxy-nestjs/apis/account_security.api";
import {
  AuthApi,
  type LoginPayload,
  type LoginResponse,
} from "roblox-proxy-nestjs/apis/auth.api";
import { ProofOfWorkApi } from "roblox-proxy-nestjs/apis/proof_of_work.api";
import { TwoStepApi } from "roblox-proxy-nestjs/apis/two_step.api";
import { Result } from "errd";

import { withError } from "../../common/utils.js";

export interface LoginWithUsernamePayload {
  username: string;
  password: string;

  captchaId?: string;
  captchaToken?: string;

  challengeId?: string;
  challengeType?: string;

  securityQuestionSessionId?: string;
  securityQuestionUserId?: string;
  securityQuestionAnswer?: string[];

  proofOfWorkPuzzleSessionId?: string;
  proofOfWorkPuzzleSolution?: string;
}

export interface LoginWithTwoStepPayload {
  user: {
    id: number;
    name: string;
    displayName: string;
  };
  isBanned: boolean;
  mediaType: "email" | "sms" | "authenticator";
  ticket: string;
  code: string;
}

@Injectable()
export class LoginService {
  static DEFAULT_PROXY_TYPE = ProxyType.Residential;
  static DEFAULT_PROXY_LOCATION = { countryCode: "de" };

  private readonly logger = new Logger(LoginService.name);

  constructor(
    private readonly authApi: AuthApi,
    private readonly accountSecurityApi: AccountSecurityApi,
    private readonly proofOfWorkApi: ProofOfWorkApi,
    private readonly twoStepApi: TwoStepApi
  ) {}

  async login(payload: LoginWithUsernamePayload) {
    // Step 1. Prepare the request headers and payload.
    const headers: Record<string, any> = {};
    if (
      payload.challengeId &&
      payload.challengeType &&
      payload.proofOfWorkPuzzleSessionId &&
      payload.proofOfWorkPuzzleSolution
    ) {
      if (payload.challengeType !== "proofofwork") {
        throw new BadRequestException("Invalid challenge type.");
      }
      headers["rblx-challenge-id"] = payload.challengeId;
      headers["rblx-challenge-type"] = payload.challengeType;
      headers["rblx-challenge-metadata"] = await this.solveProofOfWorkPuzzle(
        payload.proofOfWorkPuzzleSessionId,
        payload.proofOfWorkPuzzleSolution
      );
    }
    const data: LoginPayload = {
      ctype: "Username",
      cvalue: payload.username,
      password: payload.password,
    };
    if (
      payload.securityQuestionSessionId &&
      payload.securityQuestionUserId &&
      payload.securityQuestionAnswer
    ) {
      data.securityQuestionRedemptionToken = await this.answerSecurityQuestion(
        payload.securityQuestionSessionId,
        payload.securityQuestionUserId,
        payload.securityQuestionAnswer
      );
      data.securityQuestionSessionId = payload.securityQuestionSessionId;
    }
    if (payload.captchaId && payload.captchaToken) {
      data.captchaId = payload.captchaId;
      data.captchaToken = payload.captchaToken;
    }

    // Step 2. Send the request and handle the errorneous response if any.
    const clientId = generateClientId(`cid=Username,${payload.username}`);
    const config = {
      clientId,
      proxyType: LoginService.DEFAULT_PROXY_TYPE,
      proxyLocation: LoginService.DEFAULT_PROXY_LOCATION,
    };
    const result = await Result.fromAsync(() =>
      this.authApi.login(data, config, headers)
    );
    if (result.isErr()) {
      return withError(result, async (error) => {
        if (error.statusCode === 403) {
          if (error.errorCode === 1) {
            // Incorrect password
            throw new BadRequestException("Incorrect password.");
          } else if (error.errorCode === 0 && error.headers) {
            // Challenge required
            const challenge = this.twoStepApi.getChallenge(error.headers);
            if (!challenge) {
              throw new BadRequestException(
                "Expected a challenge to be required."
              );
            }
            if (challenge.type !== "proofofwork") {
              this.logger.debug(
                `Unexpected challenge type: ${error.headers["rblx-challenge-type"]}`
              );
              throw new BadRequestException(
                `An unexpected challenge type was required: ${error.headers["rblx-challenge-type"]}`
              );
            }
            const { sessionId: challengeSessionId } =
              this.twoStepApi.decodeChallengeMetadata(challenge.metadata);
            const proofOfWorkPuzzle = await this.getProofOfWorkPuzzle(
              challengeSessionId
            );
            return {
              ok: false,
              error: "proof_of_work_required",
              challengeId: challenge.id,
              challengeType: challenge.type,
              challengeSessionId,
              proofOfWorkPuzzle,
            };
          } else if (error.errorCode === 2 && error.fieldData) {
            // Captcha required
            const { dxBlob: captchaBlob, unifiedCaptchaId: captchaId } =
              JSON.parse(error.fieldData as string) as {
                dxBlob: string;
                unifiedCaptchaId: string;
              };
            return {
              ok: false,
              error: "captcha_required",
              captchaBlob,
              captchaId,
            };
          } else if (error.errorCode === 18 && error.fieldData) {
            // Security question required
            const {
              sessionId: securityQuestionSessionId,
              userId: securityQuestionUserId,
            } = JSON.parse(error.fieldData as string) as {
              sessionId: string;
              userId: string;
            };
            const securityQuestion = await this.getSecurityQuestion(
              securityQuestionSessionId,
              securityQuestionUserId
            );
            return {
              ok: false,
              error: "security_question_required",
              securityQuestionSessionId,
              securityQuestionUserId,
              securityQuestion,
            };
          }
        }
      });
    }

    // Step 3. Handle the successful response.
    const response = result.unwrap();
    const { user, isBanned, twoStepVerificationData }: LoginResponse =
      await response.json();
    if (twoStepVerificationData) {
      return {
        ok: false,
        error: "two_step_verification_required",
        user,
        isBanned,
        twoStepVerificationData,
      };
    }
    const cookies = response.headers.get("set-cookie");
    if (!cookies) {
      throw new BadRequestException("Something went wrong (1).");
    }
    const roblosecurity = this.finalizeLogin(clientId, cookies);
    return { ok: true, user, isBanned, roblosecurity };
  }

  async loginWithTwoStep({
    user,
    isBanned,
    mediaType,
    ticket,
    code,
  }: LoginWithTwoStepPayload) {
    const { verificationToken } = await this.twoStepApi.verifyCode(
      { userId: user.id, mediaType },
      {
        challengeId: ticket,
        actionType: "Login",
        code,
      }
    );
    const response = await this.authApi.twoStepVerificationLogin(user.id, {
      challengeId: ticket,
      verificationToken,
    });
    const cookies = response.headers.get("set-cookie");
    if (!cookies) {
      throw new BadRequestException("Something went wrong (1).");
    }
    const clientId = generateClientId(`cid=${mediaType},${user.id}`);
    const roblosecurity = this.finalizeLogin(clientId, cookies);
    return { ok: true, user, isBanned, roblosecurity };
  }

  private finalizeLogin(clientId: string, cookies: string) {
    const roblosecurity = parseRoblosecurity(cookies);
    if (!roblosecurity) {
      throw new BadRequestException("Something went wrong (2).");
    }
    const encodedSession = encodeSession(
      clientId,
      LoginService.DEFAULT_PROXY_LOCATION.countryCode
    );
    this.logger.debug(`Got roblosecurity for ${clientId}`);
    return setRoblosecurityPrefix(roblosecurity, encodedSession);
  }

  private async getProofOfWorkPuzzle(sessionId: string) {
    const puzzle = await this.proofOfWorkApi.getPuzzle({
      sessionID: sessionId,
    });
    return puzzle;
  }

  private async solveProofOfWorkPuzzle(sessionId: string, solution: string) {
    const { answerCorrect, redemptionToken } =
      await this.proofOfWorkApi.solvePuzzle({
        sessionID: sessionId,
        solution,
      });
    if (!answerCorrect) {
      throw new BadRequestException("Incorrect puzzle solution.");
    }
    const challengeMetadata = Buffer.from(
      JSON.stringify({ sessionId, redemptionToken })
    ).toString("base64");
    return challengeMetadata;
  }

  private async getSecurityQuestion(sessionId: string, userId: string) {
    const question = await this.accountSecurityApi.getQuestion({
      sessionId,
      userId,
    });
    return question;
  }

  private async answerSecurityQuestion(
    sessionId: string,
    userId: string,
    answer: string[]
  ) {
    const { answerCorrect, redemptionToken } =
      await this.accountSecurityApi.answerQuestion({
        sessionId,
        userId,
        answer,
      });
    if (!answerCorrect) {
      throw new BadRequestException("Incorrect security question answer.");
    }
    return redemptionToken;
  }
}
