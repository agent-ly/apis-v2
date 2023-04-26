import { createZodDto } from "nestjs-zod";
import { z } from "nestjs-zod/z";

const EditItemRatePayloadSchema = z.object({
  newRate: z.number().positive(),
  expectedNewPrice: z.number().positive(),
});

export class EditItemRatePayloadDto extends createZodDto(
  EditItemRatePayloadSchema
) {}
