import { ApiProperty } from "@nestjs/swagger";
import { Length } from "class-validator";

export class VerifyAuthenticatorPayloadDto {
  @ApiProperty()
  @Length(6)
  code: string;
}
