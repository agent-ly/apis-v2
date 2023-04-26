import { transform } from "@swc/core";

/**
 * @param {string} source
 * @param {string} fileName
 */
export async function compile(source, fileName) {
  const { code } = await transform(source, {
    filename: fileName,
    swcrc: true,
    sourceMaps: "inline",
  });
  return code;
}
