import { IsBtcAddress, IsPositive } from "class-validator";

export class WithdrawPayloadDto {
  @IsBtcAddress()
  address: string;

  @IsPositive()
  amount: number;
}
