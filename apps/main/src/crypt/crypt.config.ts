import { registerAs } from "@nestjs/config";

export default registerAs("crypt", () => ({
  algorithm: process.env.CRYPT_ALGORITHM || "aes-256-gcm",
  secret: process.env.CRYPT_SECRET || Buffer.alloc(32),
}));
