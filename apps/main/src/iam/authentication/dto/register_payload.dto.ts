import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty } from "class-validator";

export class RegisterPayloadDto {
  @ApiProperty()
  @IsNotEmpty()
  username: string;
}
