import { Doc } from "../../common/interfaces/doc.interface.js";
import { DbItemType } from "./enums/db_item_type.enum.js";

export interface DbItem extends Doc<number> {
  userId: string;
  assetId: number;
  serial: number | null;
  name: string;
  rap: number;
  value: number;
  available: boolean;
  // ... type-specific fields
  details: unknown | null;
}

export interface BotDbItem extends DbItem {
  type: DbItemType.Bot;
  botId: number;
}

export interface ShopDbItem extends DbItem {
  type: DbItemType.Shop;
  sellerId: number;
  rate: number;
  price: number;
}
