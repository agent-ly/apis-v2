import { createZodDto } from "nestjs-zod";
import { z } from "nestjs-zod/z";

const RefreshPayloadSchema = z.object({
  refreshToken: z.string(),
});

export class RefreshPayloadDto extends createZodDto(RefreshPayloadSchema) {}
