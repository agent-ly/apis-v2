import { Injectable } from "@nestjs/common";

import { RobloxClient } from "../roblox.client.js";

export interface GetPuzzleResponse {
  puzzleType: 1;
  artifacts: string;
}

export interface SolvePuzzlePayload {
  sessionID: string;
  solution: string;
}

export interface SolvePuzzleResponse {
  answerCorrect: boolean;
  redemptionToken?: string;
}

@Injectable()
export class ProofOfWorkApi {
  constructor(private readonly client: RobloxClient) {}

  getPuzzle(sessionID: string): Promise<GetPuzzleResponse> {
    const url = `https://apis.roblox.com/proof-of-work-service/v1/pow-puzzle?sessionID=${sessionID}`;
    return this.client.json(url);
  }

  solvePuzzle(data: SolvePuzzlePayload): Promise<SolvePuzzleResponse> {
    const url = "https://apis.roblox.com/proof-of-work-service/v1/pow-puzzle";
    const init = { method: "POST", data };
    return this.client.json(url, init);
  }
}
