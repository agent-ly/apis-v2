import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, ValidateIf } from "class-validator";

export class AttachPayloadDto {
  @ApiProperty()
  @IsEnum(["username_password", "roblosecurity"])
  strategy: "username_password" | "roblosecurity";

  @ApiProperty()
  @ValidateIf(({ strategy }) => strategy === "username_password")
  username: string;

  @ApiProperty()
  @ValidateIf(({ strategy }) => strategy === "username_password")
  password: string;

  @ApiProperty()
  @ValidateIf(({ strategy }) => strategy === "roblosecurity")
  roblosecurity: string;
}
