export class PlaceSellOrderEvent {
  static readonly EVENT = "shop.sell_order.place";

  public readonly buyerId: string;
  public readonly robloBuyerId: number;
  public readonly robloSellerId: number;
  public expectedCost: number;
  public expectedSellerIds: [number, string][];
  public expectedPrices: [number, number][];
  public itemIds: number[];

  constructor(params: PlaceSellOrderEventParams) {
    this.buyerId = params.buyerId;
    this.robloBuyerId = params.robloBuyerId;
    this.robloSellerId = params.robloSellerId;
    this.expectedCost = params.expectedCost;
    this.expectedSellerIds = params.expectedSellerIds;
    this.expectedPrices = params.expectedPrices;
    this.itemIds = params.itemIds;
  }
}

interface PlaceSellOrderEventParams {
  buyerId: string;
  robloBuyerId: number;
  robloSellerId: number;
  expectedCost: number;
  expectedSellerIds: [number, string][];
  expectedPrices: [number, number][];
  itemIds: number[];
}
