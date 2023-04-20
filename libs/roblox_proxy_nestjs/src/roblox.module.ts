import { Global, Module } from "@nestjs/common";

import { RobloxClient } from "./roblox.client.js";

@Global()
@Module({
  providers: [RobloxClient],
  exports: [RobloxClient],
})
export class RobloxModule {}
