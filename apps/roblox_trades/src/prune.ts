import { NestFactory } from "@nestjs/core";

import { MultiTradeService } from "./root/multi_trade/multi_trade.service.js";
import { AppModule } from "./app.module.js";

const app = await NestFactory.createApplicationContext(AppModule);
const multiTradesService = app.get(MultiTradeService);
await multiTradesService.prune(new Date());
await app.close();
