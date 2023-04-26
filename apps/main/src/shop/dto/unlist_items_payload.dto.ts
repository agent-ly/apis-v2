import { createZodDto } from "nestjs-zod";
import { z } from "nestjs-zod/z";

const UnlistItemsPayloadSchema = z.object({
  itemIds: z.array(z.number().int().positive()).nonempty().max(100),
});

export class UnlistItemsPayloadDto extends createZodDto(
  UnlistItemsPayloadSchema
) {}
