import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";

import cryptConfig from "./crypt.config.js";

@Injectable()
export class CryptService {
  constructor(
    @Inject(cryptConfig.KEY)
    private readonly config: ConfigType<typeof cryptConfig>
  ) {}

  encrypt(data: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv("aes-256-gcm", this.config.secret, iv);
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${tag.toString("base64")}.${iv.toString(
      "base64"
    )}.${encrypted.toString("base64")}`;
  }

  decrypt(data: string): string {
    const [tag, iv, encrypted] = data.split(".");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.config.secret,
      Buffer.from(iv, "base64")
    );
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, "base64")),
      decipher.final(),
    ]).toString();
  }

  encode(data: any): string {
    return Buffer.from(JSON.stringify(data)).toString("base64");
  }

  decode(data: string): any {
    return JSON.parse(Buffer.from(data, "base64").toString());
  }
}
