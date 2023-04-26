import { createZodDto } from "nestjs-zod";
import { z } from "nestjs-zod/z";

const RegisterPayloadSchema = z.object({
  username: z.string().min(2).max(20),
});

export class RegisterPayloadDto extends createZodDto(RegisterPayloadSchema) {}
