import type { UnpluginInstance } from "unplugin";
import type { FilterPattern } from "@rollup/pluginutils";
import type { Options } from "@swc/core";

export interface UnpluginSwcOptions {
  include?: FilterPattern;
  exclude?: FilterPattern;
  minify?: boolean;
}

export const swc: UnpluginInstance<UnpluginSwcOptions | undefined, boolean>;
