import { createZodDto } from "nestjs-zod";
import { z } from "zod";

const TransactItemsPayloadDtoSchema = z.object({
  itemIds: z.array(z.number().int().positive()).nonempty().max(100),
  smallItemId: z.number().int().positive().optional(),
});

export class TransactItemsPayloadDto extends createZodDto(
  TransactItemsPayloadDtoSchema
) {}
