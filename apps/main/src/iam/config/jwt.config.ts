import { registerAs } from "@nestjs/config";

export default registerAs("jwt", () => ({
  secret: process.env.JWT_SECRET || "jwt_secret",
  issuer: process.env.JWT_ISSUER || "jwt_issuer",
  audience: process.env.JWT_AUDIENCE || "jwt_audience",
  accessTtl: process.env.JWT_ACCESS_TTL || "1d",
  refreshTtl: process.env.JWT_REFRESH_TTL || "1w",
}));
