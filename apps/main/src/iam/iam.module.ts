import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";

import { UserSettingsModule } from "../users/user_settings/user_settings.module.js";
import { UsersModule } from "../users/users.module.js";
import jwtConfig from "./config/jwt.config.js";
import otpConfig from "./config/otp.config.js";
import { HashingService } from "./hashing/hashing.service.js";
import { Argon2Service } from "./hashing/argon2.service.js";
import { RefreshTokenIdsStorage } from "./authentication/storages/refresh_token_ids.storage.js";
import { UsedOtpTokensStorage } from "./authentication/storages/used_otp_tokens.storage.js";
import { OtpAuthenticationService } from "./authentication/otp_authentication.service.js";
import { AuthenticationService } from "./authentication/authentication.service.js";
import { AuthenticationController } from "./authentication/authentication.controller.js";
import { BearerTokenGuard } from "./authentication/guards/bearer_token.guard.js";
import { AuthenticationGuard } from "./authentication/guards/authentication.guard.js";
import { RolesGuard } from "./authorization/guards/roles.guard.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [jwtConfig, otpConfig],
    }),
    JwtModule.registerAsync(jwtConfig.asProvider()),
    UsersModule,
    UserSettingsModule,
  ],
  providers: [
    { provide: HashingService, useClass: Argon2Service },
    BearerTokenGuard,
    { provide: APP_GUARD, useClass: AuthenticationGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    UsedOtpTokensStorage,
    RefreshTokenIdsStorage,
    OtpAuthenticationService,
    AuthenticationService,
  ],
  controllers: [AuthenticationController],
})
export class IamModule {}
