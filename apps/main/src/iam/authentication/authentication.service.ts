import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { MongoServerError } from "mongodb";
import { nanoid } from "nanoid";

import { UserSettingsService } from "../../users/user_settings/user_settings.service.js";
import { User } from "../../users/user.entity.js";
import { UsersService } from "../../users/users.service.js";
import jwtConfig from "../config/jwt.config.js";
import { HashingService } from "../hashing/hashing.service.js";
import type { ActiveUserData } from "../interfaces/active_user_data.interface.js";
import { OtpAuthenticationService } from "./otp_authentication.service.js";
import { UsedOtpTokensStorage } from "./storages/used_otp_tokens.storage.js";
import { RefreshTokenIdsStorage } from "./storages/refresh_token_ids.storage.js";
import { RegisterPayloadDto } from "./dto/register_payload.dto.js";
import { LoginPayloadDto } from "./dto/login_payload.dto.js";
import { RefreshPayloadDto } from "./dto/refresh_payload.dto.js";
import { SetupAuthentictorPayloadDto } from "./dto/setup_authenticator_payload.dto.js";
import { VerifyAuthenticatorPayloadDto } from "./dto/verify_authenticator_payload.dto.js";
import { RemoveAuthenticatorPayloadDto } from "./dto/remove_authenticator._payload.dto.js";
import { AttachPayloadDto } from "./dto/attach_payload.dto.js";

@Injectable()
export class AuthenticationService {
  constructor(
    @Inject(jwtConfig.KEY)
    private readonly config: ConfigType<typeof jwtConfig>,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly userSettingsService: UserSettingsService,
    private readonly hashingService: HashingService,
    private readonly otpAuthenticationService: OtpAuthenticationService,
    private readonly usedOtpTokensStorage: UsedOtpTokensStorage,
    private readonly refreshTokenIdsStorage: RefreshTokenIdsStorage
  ) {}

  async register(payload: RegisterPayloadDto) {
    try {
      const password = nanoid();
      const user = await this.usersService.insert(payload.username);
      const hashed = await this.hashingService.hash(password);
      await this.userSettingsService.create(user._id, hashed);
      return password;
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) {
        throw new ConflictException("A user with that name already exists.");
      }
      throw new BadRequestException("Something went wrong.");
    }
  }

  async login(payload: LoginPayloadDto) {
    const user = await this.usersService.findByName(payload.username);
    if (!user) {
      throw new UnauthorizedException("Invalid username.");
    }
    const settings = await this.userSettingsService.findByIdOrThrow(user._id);
    await this.validatePassword(payload.password, settings.security.password);
    if (settings.security.authenticator?.verified) {
      await this.validateOtpToken(
        payload.code,
        settings.security.authenticator.secret
      );
    }
    return this.generateJwtTokens(user);
  }

  async refresh(payload: RefreshPayloadDto) {
    const { sub, refreshTokenId } = await this.jwtService.verifyAsync<
      Pick<ActiveUserData, "sub"> & { refreshTokenId: string }
    >(payload.token);
    const user = await this.usersService.findByIdOrThrow(sub);
    const isValid = await this.refreshTokenIdsStorage.validate(
      user._id,
      refreshTokenId
    );
    if (!isValid) {
      throw new ForbiddenException("Invalid refresh token.");
    }
    await this.refreshTokenIdsStorage.invalidate(user._id);
    return this.generateJwtTokens(user);
  }

  async attach(payload: AttachPayloadDto) {}

  async setupAuthenticator(
    userId: string,
    payload: SetupAuthentictorPayloadDto
  ) {
    const user = await this.usersService.findByIdOrThrow(userId);
    const settings = await this.userSettingsService.findByIdOrThrow(userId);
    if (settings.security.authenticator) {
      throw new BadRequestException("Authenticator already setup.");
    }
    await this.validatePassword(payload.password, settings.security.password);
    const secret = await this.userSettingsService.setupAuthenticator(settings);
    return this.otpAuthenticationService.generateUri(user.name, secret);
  }

  async verifyAuthenticator(
    userId: string,
    payload: VerifyAuthenticatorPayloadDto
  ) {
    const settings = await this.userSettingsService.findByIdOrThrow(userId);
    if (!settings.security.authenticator) {
      throw new BadRequestException("Authenticator not setup.");
    }
    if (settings.security.authenticator.verified) {
      throw new BadRequestException("Authenticator alread verified.");
    }
    await this.validateOtpToken(
      payload.code,
      settings.security.authenticator.secret
    );
    await this.userSettingsService.verifyAuthenticator(settings);
  }

  async removeAuthenticator(
    userId: string,
    payload: RemoveAuthenticatorPayloadDto
  ) {
    const settings = await this.userSettingsService.findByIdOrThrow(userId);
    if (!settings.security.authenticator?.verified) {
      throw new BadRequestException("Authenticator not setup.");
    }
    await this.validateOtpToken(
      payload.code,
      settings.security.authenticator.secret
    );
    await this.userSettingsService.removeAuthenticator(settings);
  }

  private async validatePassword(password: string, passwordHash: string) {
    const equal = await this.hashingService.compare(password, passwordHash);
    if (!equal) {
      throw new UnauthorizedException("Invalid password.");
    }
  }

  private async validateOtpToken(token: string | undefined, secret: string) {
    if (!token) {
      throw new ForbiddenException("Two-factor authentication is required.");
    }
    const valid = this.otpAuthenticationService.validate(token, secret);
    if (!valid) {
      throw new ForbiddenException("Invalid two-factor authentication token.");
    }
    const used = await this.usedOtpTokensStorage.isUsed(token);
    if (used) {
      throw new ForbiddenException("Token already used.");
    }
    await this.usedOtpTokensStorage.use(token);
  }

  private async generateJwtTokens(user: User) {
    const refreshTokenId = randomUUID();
    const [accessToken, refreshToken] = await Promise.all([
      this.signJwtPayload<Partial<ActiveUserData>>(
        user._id,
        this.config.accessTtl,
        { name: user.name, role: user.role }
      ),
      this.signJwtPayload(user._id, this.config.refreshTtl, {
        refreshTokenId,
      }),
    ]);
    await this.refreshTokenIdsStorage.insert(user._id, refreshTokenId);
    return { accessToken, refreshToken };
  }

  private signJwtPayload<TPayload>(
    userId: string,
    expiresIn: string,
    payload: TPayload
  ) {
    return this.jwtService.signAsync(
      { sub: userId, ...payload },
      { expiresIn }
    );
  }
}
