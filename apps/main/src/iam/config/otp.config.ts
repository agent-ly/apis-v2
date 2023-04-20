import { registerAs } from "@nestjs/config";

export default registerAs("otp", () => ({
  issuer: process.env.OTP_ISSUER || "otp_issuer",
}));
