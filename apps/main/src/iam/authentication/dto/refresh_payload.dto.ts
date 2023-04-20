import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty } from "class-validator";

export class RefreshPayloadDto {
  @ApiProperty()
  @IsNotEmpty()
  token: string;
}
