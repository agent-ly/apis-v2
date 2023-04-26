import { createZodDto } from "nestjs-zod";
import { z } from "nestjs-zod/z";

import { BotType } from "../enums/bot_type.enum.js";

const CreateBotPayloadSchema = z.object({
  type: z.nativeEnum(BotType),
  userId: z.number(),
  username: z.string(),
  roblosecurity: z.string(),
  roblosecret: z.string().optional(),
});

export class CreateBotPayloadDto extends createZodDto(CreateBotPayloadSchema) {}
