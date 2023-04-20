import { Doc } from "../../common/interfaces/doc.interface.js";

export interface ShopSale extends Doc {
  buyerId: number;
  sellerId: number;
  itemId: number;
  assetId: number;
  serial: number | null;
  name: string;
  rate: number;
  price: number;
}
