import { Module } from "@nestjs/common";

import { LinkModule } from "./link/link.module.js";
import { LoginModule } from "./login/login.module.js";

@Module({
  imports: [LinkModule, LoginModule],
})
export class AuthModule {}
