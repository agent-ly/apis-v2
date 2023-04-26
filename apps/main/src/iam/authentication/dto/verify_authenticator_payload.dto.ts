import { createZodDto } from "nestjs-zod";
import { z } from "nestjs-zod/z";

const VerifyAuthenticatorPayloadSchema = z.object({
  code: z.string().min(6),
});

export class VerifyAuthenticatorPayloadDto extends createZodDto(
  VerifyAuthenticatorPayloadSchema
) {}
