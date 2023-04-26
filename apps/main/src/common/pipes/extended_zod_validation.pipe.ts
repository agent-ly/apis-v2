import { ArgumentMetadata } from "@nestjs/common";
import { ZodValidationPipe } from "nestjs-zod";

export class ExtendedZodValidationPipe extends ZodValidationPipe {
  transform(value: unknown, metadata: ArgumentMetadata) {
    if (
      metadata.data &&
      (metadata.type === "param" || metadata.type === "query")
    ) {
      if (metadata.metatype === Boolean) {
        return Boolean(value);
      }
      if (metadata.metatype === Number) {
        return Number(value);
      }
      return value;
    }
    return super.transform(value, metadata);
  }
}
