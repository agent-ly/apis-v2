import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty } from "class-validator";

export class SetupAuthentictorPayloadDto {
  @ApiProperty()
  @IsNotEmpty()
  password: string;
}
