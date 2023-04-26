import { registerAs } from "@nestjs/config";

export default registerAs("crypt", () => ({
  secret: process.env.CRYPT_SECRET
    ? Buffer.from(process.env.CRYPT_SECRET, "hex")
    : Buffer.alloc(32),
}));
