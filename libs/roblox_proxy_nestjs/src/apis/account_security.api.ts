import { Injectable } from "@nestjs/common";
import { RobloxClient } from "../roblox.client.js";

export enum SecurityQuestionsError {
  UNKNOWN = 1,
  REQUEST_TYPE_WAS_INVALID = 2,
  SECURITY_QUESTIONS_DISABLED = 3,
  SESSION_INACTIVE = 4,
  QUESTION_NOT_FOUND = 5,
  ANSWER_WRONG_FORMAT = 6,
}

export interface GetQuestionQuery {
  userId: string;
  sessionId: string;
}

export interface GetQuestionResponse {
  questionType: 0 | 1;
  answerChoices: string[];
  answerPrompt: 0 | 1;
  correctAnswerChoiceCount?: number;
}

export interface AnswerQuestionPayload {
  userId: string;
  sessionId: string;
  answer: string[];
}

export interface AnswerQuestionResponse {
  answerCorrect: boolean;
  shouldRequestNewQuestion: boolean;
  redemptionToken?: string;
  userWasForceReset?: boolean;
}

@Injectable()
export class AccountSecurityApi {
  constructor(private readonly client: RobloxClient) {}

  getQuestion({
    userId,
    sessionId,
  }: GetQuestionQuery): Promise<GetQuestionResponse> {
    const url = `https://apis.roblox.com/account-security-service/v1/security-question?userId=${userId}&sessionId=${sessionId}`;
    return this.client.json(url);
  }

  answerQuestion(data: AnswerQuestionPayload): Promise<AnswerQuestionResponse> {
    const url =
      "https://apis.roblox.com/account-security-service/v1/security-question";
    const init = { method: "POST", data };
    return this.client.json(url, init);
  }
}
