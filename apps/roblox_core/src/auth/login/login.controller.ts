import { Controller, Body, Post, UseFilters } from "@nestjs/common";
import { RobloxExceptionFilter } from "roblox-proxy-nestjs";

import {
  LoginService,
  type LoginWithUsernamePayload,
  type LoginWithTwoStepPayload,
} from "./login.service.js";

@Controller("auth/login")
@UseFilters(RobloxExceptionFilter)
export class LoginController {
  constructor(private readonly loginService: LoginService) {}

  @Post()
  login(@Body() body: LoginWithUsernamePayload) {
    return this.loginService.login(body);
  }

  @Post("/two-step")
  loginWithTwoStep(@Body() body: LoginWithTwoStepPayload) {
    return this.loginService.loginWithTwoStep(body);
  }
}
