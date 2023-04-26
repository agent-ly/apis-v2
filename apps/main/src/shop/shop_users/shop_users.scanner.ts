import { Injectable } from "@nestjs/common";

import { WorkerHost } from "../../common/classes/worker-host.js";

@Injectable()
export class ShopUsersScanner extends WorkerHost {
  process(): Promise<void> {
    throw new Error("Method not implemented.");
  }
}
