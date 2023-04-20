import { MultiTradeJobStrategy } from "./multi_trade/multi_trade.entity.js";

export class MultiTradeUserDto {
  id: number;
  roblosecurity: string;
  totpSecret?: string;
  userAssetIds: number[];
  recyclableUserAssetIds: number[];
}

export class AddOneToOneMutliTradePayloadDto {
  maxItemsPerTrade: number;
  strategy: MultiTradeJobStrategy;
  sender: MultiTradeUserDto;
  receiver: MultiTradeUserDto;
}

export class AddManyToOneMutliTradePayloadDto {
  maxItemsPerTrade: number;
  strategy: MultiTradeJobStrategy;
  senders: MultiTradeUserDto[];
  receiver: MultiTradeUserDto;
}
