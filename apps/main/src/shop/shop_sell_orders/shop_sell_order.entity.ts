import { Doc } from "../../common/interfaces/doc.interface.js";
import { ShopSellOrderStatus } from "./enums/shop_sell_order_status.entity.js";

export interface ShopSellOrder extends Doc {
  transactionId: string;
  itemTransactionId: string | null;
  nextOrderId: string | null;
  buyerId: string;
  robloBuyerId: number;
  robloSellerId: number;
  status: ShopSellOrderStatus;
  expectedCost: number;
  expectedPrices: [number, number][];
  expectedSellerIds: [number, string][];
  itemIds: number[];
}
