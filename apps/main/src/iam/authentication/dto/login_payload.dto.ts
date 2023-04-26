import { createZodDto } from "nestjs-zod";
import { z } from "nestjs-zod/z";

const LoginPayloadSchema = z.object({
  username: z.string().min(2).max(20),
  password: z.string().min(8).max(64),
  code: z.string().min(6).optional(),
});

export class LoginPayloadDto extends createZodDto(LoginPayloadSchema) {}
