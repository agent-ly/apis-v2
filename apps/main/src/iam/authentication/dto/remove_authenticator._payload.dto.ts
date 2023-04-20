import { ApiProperty } from "@nestjs/swagger";
import { Length } from "class-validator";

export class RemoveAuthenticatorPayloadDto {
  @ApiProperty()
  @Length(6)
  code: string;
}
