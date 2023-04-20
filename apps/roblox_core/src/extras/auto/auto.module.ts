import { Module } from "@nestjs/common";
import { BillingApi } from "roblox-proxy-nestjs/apis/billing.api";
import { PaymentsApi } from "roblox-proxy-nestjs/apis/payments.api";

import { AutoService } from "./auto.service.js";
import { AutoController } from "./auto.controller.js";

@Module({
  providers: [BillingApi, PaymentsApi, AutoService],
  controllers: [AutoController],
})
export class AutoModule {}
