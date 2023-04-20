import { BadRequestException, Injectable } from "@nestjs/common";

import type {
  RolimonsApiResponse,
  RolimonsItemDetailsResponse,
} from "./rolimons.interfaces.js";

@Injectable()
export class RolimonsService {
  private fallback?: RolimonsItemDetailsResponse;

  async getItemDetails(): Promise<RolimonsItemDetailsResponse | null> {
    const response = await fetch("https://rolimons.com/itemapi/itemdetails");
    const data: RolimonsApiResponse<RolimonsItemDetailsResponse> =
      await response.json();
    if (data.success === false) {
      if (this.fallback) {
        return this.fallback;
      }
      return null;
    }
    return data;
  }
}
