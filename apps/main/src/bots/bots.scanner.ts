import { Injectable } from "@nestjs/common";

import { WorkerHost } from "../common/classes/worker-host.js";

@Injectable()
export class BotsScanner extends WorkerHost {
  process(): void | Promise<void> {
    throw new Error("Method not implemented.");
  }
}
