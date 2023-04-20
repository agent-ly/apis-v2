import { Module } from "@nestjs/common";

import { RobloxService } from "./roblox.service.js";

@Module({
  providers: [RobloxService],
  exports: [RobloxService],
})
export class RobloxModule {}
