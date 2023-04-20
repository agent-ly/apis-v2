import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import cryptConfig from "./crypt.config.js";
import { CryptService } from "./crypt.service.js";

@Module({
  imports: [ConfigModule.forFeature(cryptConfig)],
  providers: [CryptService],
  exports: [CryptService],
})
export class CryptModule {}
