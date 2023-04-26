import { MultiTradeChildStrategy } from "./multi_trade/multi_trade.entity.js";

export class MultiTradeUserDto {
  id: number;
  roblosecurity: string;
  roblosecret?: string;
  userAssetIds: number[];
  recyclableUserAssetIds: number[];
}

export class AddOneToOneMutliTradePayloadDto {
  maxItemsPerTrade: number;
  strategy: MultiTradeChildStrategy;
  receiver: MultiTradeUserDto;
  sender: MultiTradeUserDto;
}

export class AddManyToOneMutliTradePayloadDto {
  maxItemsPerTrade: number;
  strategy: MultiTradeChildStrategy;
  receiver: MultiTradeUserDto;
  senders: MultiTradeUserDto[];
}
