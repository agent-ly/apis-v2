import { registerAs } from "@nestjs/config";

export default registerAs("roblox", () => ({
  coreUrl: process.env.ROBLOX_CORE_URL || "http://localhost:8071",
  tradesUrl: process.env.ROBLOX_TRADES_URL || "http://localhost:8072",
  tradesWsUrl: process.env.RBOLOX_TRADES_WS_URL || "ws://localhost:8072",
}));
