import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, Length } from "class-validator";

export class LoginPayloadDto {
  @ApiProperty()
  @Length(2, 20)
  username: string;

  @ApiProperty()
  @Length(8, 64)
  password: string;

  @ApiProperty()
  @IsOptional()
  @Length(6)
  code?: string;
}
