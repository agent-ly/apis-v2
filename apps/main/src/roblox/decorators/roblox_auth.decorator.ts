import { UseGuards } from "@nestjs/common";

import { RobloxAuthenticationGuard } from "../guards/roblox_authentication.guard.js";

export const RobloxAuth = () => UseGuards(RobloxAuthenticationGuard);
