import { createZodDto } from "nestjs-zod";
import { z } from "nestjs-zod/z";

const BuyItemsPayloadSchema = z.object({
  expectedPrices: z
    .array(z.tuple([z.number().int().positive(), z.number().positive()]))
    .nonempty()
    .max(100),
  expectedSellerIds: z
    .array(z.tuple([z.number().int().positive(), z.string()]))
    .nonempty()
    .max(100),
  itemIds: z.array(z.number().int().positive()).nonempty().max(100),
});

export class BuyItemsPayloadDto extends createZodDto(BuyItemsPayloadSchema) {}
