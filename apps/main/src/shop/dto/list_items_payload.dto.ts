import { createZodDto } from "nestjs-zod";
import { z } from "nestjs-zod/z";

const LitemItemsPayloadSchema = z.object({
  rate: z.number().optional(),
  rates: z
    .array(z.tuple([z.number().int().positive(), z.number().positive()]))
    .nonempty()
    .max(100)
    .optional(),
  itemIds: z.array(z.number().int().positive()).nonempty().max(100),
});

export class ListItemsPayloadDto extends createZodDto(
  LitemItemsPayloadSchema
) {}
