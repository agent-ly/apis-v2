// @ts-check

import { isAbsolute } from "node:path";
import { cwd } from "node:process";
import { pathToFileURL, fileURLToPath } from "node:url";

import { compile } from "./compiler.js";

const format = "module";
const baseURL = pathToFileURL(`${cwd()}/`).href;

/** @type {Set<string>} */
const resolvedUrls = new Set();
/** @type {Map<string, string>} */
const resolveCache = new Map();
/** @type {Map<string, import('./loader.js').LoadResult>} */
const loadCache = new Map();

/** @type {import('./loader.js').ResolveFn} */
export async function resolve(specifier, context, nextResolve) {
  const url = resolveCache.get(specifier);
  if (url) {
    return { url, shortCircuit: true };
  }
  const { parentURL = baseURL } = context;
  if (
    (isAbsolute(specifier) ||
      specifier.startsWith("file:") ||
      specifier.startsWith(".")) &&
    (specifier.endsWith(".js") || specifier.endsWith(".ts")) &&
    parentURL.startsWith(baseURL)
  ) {
    const url = new URL(
      specifier.endsWith(".js") && parentURL.endsWith(".ts")
        ? `${specifier.slice(0, -3)}.ts`
        : specifier,
      parentURL
    ).href;
    resolveCache.set(specifier, url);
    resolvedUrls.add(url);
    return { url, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}

/** @type {import('./loader.js').LoadFn} */
export async function load(url, context, nextLoad) {
  if (resolvedUrls.has(url)) {
    let result = loadCache.get(url);
    if (!result) {
      let { source: rawSource } = await nextLoad(url, {
        ...context,
        format,
      });
      if (typeof rawSource !== "string") {
        rawSource = new TextDecoder().decode(rawSource);
      }
      const source = await compile(rawSource, fileURLToPath(url));
      result = { source, format, shortCircuit: true };
      loadCache.set(url, result);
    }
    return result;
  }
  return nextLoad(url, context);
}
