import { Inject, Injectable } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { TOTP } from "otpauth";

import otpConfig from "../config/otp.config.js";

@Injectable()
export class OtpAuthenticationService {
  constructor(
    @Inject(otpConfig.KEY)
    private readonly config: ConfigType<typeof otpConfig>
  ) {}

  generateUri(label: string, secret: string): string {
    const otp = new TOTP({ issuer: this.config.issuer, label, secret });
    const uri = otp.toString();
    return uri;
  }

  validate(token: string, secret: string): boolean {
    const otp = new TOTP({ secret });
    const delta = otp.validate({ token });
    return delta !== null;
  }
}
