import { Module, type DynamicModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { RobloxModule } from "roblox-proxy-nestjs";

import { AuthModule } from "./auth/auth.module.js";
import { ExtrasModule } from "./extras/extras.module.js";

type AppFeatures = "auth" | "extras";

@Module({
  imports: [ConfigModule.forRoot(), RobloxModule],
})
export class AppModule {
  private static readonly DEFAULT_FEATURES = "auth,extras";

  static forRoot(): DynamicModule {
    const features = this.getFeaturesFromEnv();
    const imports: DynamicModule["imports"] = [];
    if (features.includes("auth")) {
      imports.push(AuthModule);
    }
    if (features.includes("extras")) {
      imports.push(ExtrasModule);
    }
    return { module: AppModule, imports };
  }

  private static getFeaturesFromEnv(): AppFeatures[] {
    const featuresString = process.env.FEATURES ?? this.DEFAULT_FEATURES;
    const features = featuresString.split(",");
    return features as AppFeatures[];
  }
}
