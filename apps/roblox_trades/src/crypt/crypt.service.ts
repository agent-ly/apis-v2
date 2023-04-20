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
    const cipher = createCipheriv(
      this.config.algorithm,
      this.config.secret,
      iv
    );
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    return `${iv.toString("base64")}.${encrypted.toString("base64")}`;
  }

  decrypt(encrypted: string): string {
    const [iv, data] = encrypted.split(".");
    const decipher = createDecipheriv(
      this.config.algorithm,
      this.config.secret,
      Buffer.from(iv, "base64")
    );
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(data, "base64")),
      decipher.final(),
    ]);
    return decrypted.toString();
  }
}
