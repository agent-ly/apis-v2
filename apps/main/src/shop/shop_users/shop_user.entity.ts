import { Account } from "../../common/interfaces/account.interface.js";
import { ShopUserType } from "./enums/shop_user_type.enum.js";

export interface ShopUser extends Account {}

export interface ShopSeller extends ShopUser {
  type: ShopUserType.Seller;
}

export interface ShopBuyer extends ShopUser {
  type: ShopUserType.Buyer;
}
