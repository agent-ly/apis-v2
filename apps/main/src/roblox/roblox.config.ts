import { registerAs } from "@nestjs/config";

export default registerAs("roblox", () => ({
  coreUrl: process.env.ROBLOX_CORE_URL || "http://localhost:80871",
  tradesUrl: process.env.ROBLOX_TRADES_URL || "http://localhost:80872",
  tradesWsUrl: process.env.RBOLOX_TRADES_WS_URL || "ws://localhost:80872",
}));
