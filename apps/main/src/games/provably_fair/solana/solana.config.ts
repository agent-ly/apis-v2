import { registerAs } from "@nestjs/config";

export default registerAs("solana", () => ({
  rpcUrl: process.env.SOLANA_RPC_URL,
}));
