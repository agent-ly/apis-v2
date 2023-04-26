import { createZodDto } from "nestjs-zod";
import { z } from "nestjs-zod/z";

const SetupAuthenticatorPayloadSchema = z.object({
  password: z.string().min(8).max(64),
});

export class SetupAuthenticatorPayloadDto extends createZodDto(
  SetupAuthenticatorPayloadSchema
) {}
