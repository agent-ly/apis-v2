import { Module } from "@nestjs/common";
import { AccountSecurityApi } from "roblox-proxy-nestjs/apis/account_security.api";
import { AuthApi } from "roblox-proxy-nestjs/apis/auth.api";
import { ProofOfWorkApi } from "roblox-proxy-nestjs/apis/proof_of_work.api";
import { TwoStepApi } from "roblox-proxy-nestjs/apis/two_step.api";

import { LoginService } from "./login.service.js";
import { LoginController } from "./login.controller.js";

@Module({
  providers: [
    AuthApi,
    AccountSecurityApi,
    ProofOfWorkApi,
    TwoStepApi,
    LoginService,
  ],
  controllers: [LoginController],
})
export class LoginModule {}
