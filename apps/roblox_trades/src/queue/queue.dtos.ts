import { MultiTradeChildStrategy } from "./multi_trade/multi_trade.entity.js";

export class MultiTradeUserDto {
  id: number;
  roblosecurity: string;
  totpSecret?: string;
  userAssetIds: number[];
  recyclableUserAssetIds: number[];
}

export class AddOneToOneMutliTradePayloadDto {
  maxItemsPerTrade: number;
  strategy: MultiTradeChildStrategy;
  sender: MultiTradeUserDto;
  receiver: MultiTradeUserDto;
}

export class AddManyToOneMutliTradePayloadDto {
  maxItemsPerTrade: number;
  strategy: MultiTradeChildStrategy;
  senders: MultiTradeUserDto[];
  receiver: MultiTradeUserDto;
}
