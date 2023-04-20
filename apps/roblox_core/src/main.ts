import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";

import { AppModule } from "./app.module.js";

const app = await NestFactory.create<NestFastifyApplication>(
  AppModule.forRoot(),
  new FastifyAdapter()
);

await app.listen(8071);

console.log("🚀 Server started on port 8071");
