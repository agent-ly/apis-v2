import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import solanaConfig from "./solana.config.js";
import { SolanaService } from "./solana.service.js";

@Module({
  imports: [ConfigModule.forFeature(solanaConfig)],
  providers: [SolanaService],
  exports: [SolanaService],
})
export class SolanaModule {}
