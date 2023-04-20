import { SetMetadata } from "@nestjs/common";

import { AuthStrategy } from "../enums/auth_strategy.enum.js";

export const AUTH_STRATEGY_METADATA_KEY = "authentication:strategy";

export const Auth = (...strategies: AuthStrategy[]) =>
  SetMetadata(AUTH_STRATEGY_METADATA_KEY, strategies);
