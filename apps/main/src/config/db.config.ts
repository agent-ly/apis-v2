import { registerAs } from "@nestjs/config";

export default registerAs("db", () => ({
  url: process.env.DB_URL || "mongodb://localhost:27017",
}));
