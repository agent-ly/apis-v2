import { Module } from "@nestjs/common";

import { AutoModule } from "./auto/auto.module.js";
import { UserModule } from "./user/user.module.js";

@Module({
  imports: [AutoModule, UserModule],
})
export class ExtrasModule {}
