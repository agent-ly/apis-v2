import { createZodDto } from "nestjs-zod";
import { z } from "nestjs-zod/z";

const WithdrawPayloadSchema = z.object({
  address: z.string(),
  amount: z.number().positive(),
});

export class WithdrawPayloadDto extends createZodDto(WithdrawPayloadSchema) {}
