import { Module, type DynamicModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { RobloxModule } from "roblox-proxy-nestjs";

import { RootModule } from "./root/root.module.js";
import { AuthModule } from "./auth/auth.module.js";

type AppFeatures = "root" | "auth";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), RobloxModule],
})
export class AppModule {
  private static readonly DEFAULT_FEATURES = "root,auth";

  static forRoot(): DynamicModule {
    const features = this.getFeaturesFromEnv();
    const imports: DynamicModule["imports"] = [];
    if (features.includes("root")) {
      imports.push(RootModule);
    }
    if (features.includes("auth")) {
      imports.push(AuthModule);
    }
    return { module: AppModule, imports };
  }

  private static getFeaturesFromEnv(): AppFeatures[] {
    const featuresString = process.env.FEATURES ?? this.DEFAULT_FEATURES;
    const features = featuresString.split(",");
    return features as AppFeatures[];
  }
}
