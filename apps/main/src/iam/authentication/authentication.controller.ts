import { Controller, HttpCode, HttpStatus, Post, Body } from "@nestjs/common";

import { AuthStrategy } from "./enums/auth_strategy.enum.js";
import { Auth } from "./decorators/auth.decorator.js";
import { ActiveUserId } from "./decorators/active_user_id.decorator.js";
import { RegisterPayloadDto } from "./dto/register_payload.dto.js";
import { LoginPayloadDto } from "./dto/login_payload.dto.js";
import { RefreshPayloadDto } from "./dto/refresh_payload.dto.js";
import { AttachPayloadDto } from "./dto/attach_payload.dto.js";
import { SetupAuthenticatorPayloadDto } from "./dto/setup_authenticator_payload.dto.js";
import { VerifyAuthenticatorPayloadDto } from "./dto/verify_authenticator_payload.dto.js";
import { RemoveAuthenticatorPayloadDto } from "./dto/remove_authenticator._payload.dto.js";
import { AuthenticationService } from "./authentication.service.js";

@Controller("auth")
export class AuthenticationController {
  constructor(private readonly authenticationService: AuthenticationService) {}

  @Post("register")
  register(@Body() payload: RegisterPayloadDto) {
    return this.authenticationService.register(payload);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  login(@Body() payload: LoginPayloadDto) {
    return this.authenticationService.login(payload);
  }

  @Post("refresh")
  @Auth(AuthStrategy.Bearer)
  @HttpCode(HttpStatus.OK)
  refresh(@Body() payload: RefreshPayloadDto) {
    return this.authenticationService.refresh(payload);
  }

  @Post("attach")
  @Auth(AuthStrategy.Bearer)
  @HttpCode(HttpStatus.OK)
  attach(@Body() payload: AttachPayloadDto) {
    return this.authenticationService.attach(payload);
  }

  @Post("security/authenticator/setup")
  @Auth(AuthStrategy.Bearer)
  setupAuthenticator(
    @ActiveUserId() userId: string,
    @Body() payload: SetupAuthenticatorPayloadDto
  ) {
    return this.authenticationService.setupAuthenticator(userId, payload);
  }

  @Post("security/authenticator/verify")
  @Auth(AuthStrategy.Bearer)
  @HttpCode(HttpStatus.OK)
  verifyAuthenticator(
    @ActiveUserId() userId: string,
    @Body() payload: VerifyAuthenticatorPayloadDto
  ) {
    return this.authenticationService.verifyAuthenticator(userId, payload);
  }

  @Post("security/authenticator/remove")
  @Auth(AuthStrategy.Bearer)
  @HttpCode(HttpStatus.OK)
  removeAuthenticator(
    @ActiveUserId() userId: string,
    @Body() payload: RemoveAuthenticatorPayloadDto
  ) {
    return this.authenticationService.removeAuthenticator(userId, payload);
  }
}
