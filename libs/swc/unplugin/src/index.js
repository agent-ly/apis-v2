// @ts-check

import { createUnplugin } from "unplugin";
import { createFilter } from "@rollup/pluginutils";
import { transform } from "@swc/core";

const defaultIncludeRE = /\.[jt]s$/;
const defaultExcludeRE = /node_modules/;

/** @type {import('unplugin').UnpluginInstance<import('./index.js').UnpluginSwcOptions | undefined, boolean>} */
export const swc = createUnplugin((options = {}) => {
  const filter = createFilter(
    options.include || defaultIncludeRE,
    options.exclude || defaultExcludeRE
  );
  return {
    name: "swc",
    async transform(code, id) {
      if (!filter(id)) {
        return null;
      }
      const result = await transform(code, {
        filename: id,
        sourceMaps: true,
      });
      return { code: result.code, map: result.map };
    },
    vite: {
      config() {
        return { esbuild: false };
      },
    },
    rollup: {
      async renderChunk(code, chunk) {
        if (options.minify) {
          const result = await transform(code, {
            filename: chunk.fileName,
            sourceMaps: true,
            minify: true,
          });
          return { code: result.code, map: result.map };
        }
        return null;
      },
    },
  };
});
