import { Account } from "../common/interfaces/account.interface.js";
import { BotType } from "./enums/bot_type.enum.js";

export interface Bot extends Account {
  type: BotType;
  name: string;
}
