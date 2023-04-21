import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { MongoModule } from "nestjs-super-mongodb";
import { RobloxModule } from "roblox-proxy-nestjs";

import dbConfig from "./config/db.config.js";
import { QueueModule } from "./queue/queue.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({ load: [dbConfig] }),
    EventEmitterModule.forRoot(),
    MongoModule.forRootAsync(dbConfig.asProvider()),
    RobloxModule,
    QueueModule,
  ],
})
export class AppModule {}
