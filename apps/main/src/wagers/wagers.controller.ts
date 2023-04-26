import { Controller } from "@nestjs/common";

import { AuthStrategy } from "../iam/authentication/enums/auth_strategy.enum.js";
import { Auth } from "../iam/authentication/decorators/auth.decorator.js";

@Controller("wagers")
@Auth(AuthStrategy.Ip)
export class WagersController {}
