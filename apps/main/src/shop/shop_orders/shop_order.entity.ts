import { Doc } from "../../common/interfaces/doc.interface.js";
import { ShopOrderStatus } from "./enums/shop_order_status.entity.js";

export interface ShopOrder extends Doc {
  transactionId: string | null;
  nextId: string | null;
  buyerId: string;
  robloBuyerId: number;
  robloSellerId: number;
  status: ShopOrderStatus;
  expectedTotalPrice: number;
  expectedPrices: [number, number][];
  expectedSellerIds: [number, string][];
  itemIds: number[];
}
