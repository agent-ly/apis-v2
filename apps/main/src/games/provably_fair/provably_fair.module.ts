import { Module } from "@nestjs/common";

import { ProvablyFairService } from "./provably_fair.service.js";

@Module({
  providers: [ProvablyFairService],
  exports: [ProvablyFairService],
})
export class ProvablyFairModule {}
