import { Injectable } from "@nestjs/common";

import { RobloxClient } from "../roblox.client.js";

export interface GetUserResponse {
  id: number;
  name: string;
  displayName: string;
  description: string;
  isBanned: boolean;
}

export interface GetAuthenticatedUserResponse {
  id: number;
  name: string;
  displayName: string;
}

@Injectable()
export class UsersApi {
  constructor(private readonly client: RobloxClient) {}

  async getUser(userId: number): Promise<GetUserResponse> {
    const url = `https://users.roblox.com/v1/users/${userId}`;
    return this.client.json<GetUserResponse>(url);
  }

  async getAuthenticatedUser(
    roblosecurity: string
  ): Promise<GetAuthenticatedUserResponse> {
    const url = "https://users.roblox.com/v1/users/authenticated";
    const init = { roblosecurity };
    return this.client.json<GetAuthenticatedUserResponse>(url, init);
  }
}
