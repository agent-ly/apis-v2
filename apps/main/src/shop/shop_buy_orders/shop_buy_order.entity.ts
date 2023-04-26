import { Doc } from "../../common/interfaces/doc.interface.js";

export interface ShopBuyOrder extends Doc {
  buyerId: string;
  robloBuyerId: number;
  assetId: number;
  minRate: number;
  maxRate: number;
}
