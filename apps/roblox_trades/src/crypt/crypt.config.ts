import { registerAs } from "@nestjs/config";

export default registerAs("crypt", () => ({
  secret: process.env.CRYPT_SECRET || Buffer.alloc(32),
}));
