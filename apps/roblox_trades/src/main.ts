import { NestFactory } from "@nestjs/core";
import { FastifyAdapter } from "@nestjs/platform-fastify";
import { WsAdapter } from "@nestjs/platform-ws";

import { AppModule } from "./app.module.js";

const app = await NestFactory.create(AppModule, new FastifyAdapter());

app.useWebSocketAdapter(new WsAdapter(app));

await app.listen(8072);

console.log("💸 Server started on port 8072");
