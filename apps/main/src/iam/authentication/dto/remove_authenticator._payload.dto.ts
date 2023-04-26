import { createZodDto } from "nestjs-zod";
import { z } from "nestjs-zod/z";

const RemoveAuthenticatorPayloadSchema = z.object({
  code: z.string().min(6),
});

export class RemoveAuthenticatorPayloadDto extends createZodDto(
  RemoveAuthenticatorPayloadSchema
) {}
