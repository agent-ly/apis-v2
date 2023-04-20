import { Module } from "@nestjs/common";

import { RolimonsService } from "./rolimons.service.js";

@Module({
  providers: [RolimonsService],
  exports: [RolimonsService],
})
export class RolimonsModule {}
