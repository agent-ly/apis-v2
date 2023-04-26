import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";

import { ExtendedZodValidationPipe } from "./common/pipes/extended_zod_validation.pipe.js";
import { AppModule } from "./app.module.js";

const app = await NestFactory.create<NestFastifyApplication>(
  AppModule,
  new FastifyAdapter()
);
app.useGlobalPipes(new ExtendedZodValidationPipe());
await app.listen(8080);

console.log("🔥 Server started on port 8080");
