import { AuthStrategy } from "../enums/auth_strategy.enum.js";
import { Auth } from "./auth.decorator.js";

export const BearerAuth = () => Auth(AuthStrategy.Bearer);
