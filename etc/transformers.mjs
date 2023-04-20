// @ts-check

import { transform } from "@swc/core";
import typescript from "typescript";

const fileName = "test.js";
const source = 'export const foo = "bar";';

const transformWithSwc = async () => {
  /** @type {import("@swc/core").Options} */
  const options = {
    filename: fileName,
    module: { type: "nodenext" },
    jsc: {
      target: "esnext",
      parser: {
        syntax: "typescript",
      },
    },
  };
  const { code } = await transform(source, options);
  console.log("SWC:", code);
};

const transpileWithTypescript = async () => {
  /** @type {typescript.CompilerOptions} */
  const compilerOptions = {
    module: typescript.ModuleKind.NodeNext,
    target: typescript.ScriptTarget.ESNext,
  };
  const { outputText } = typescript.transpileModule(source, {
    compilerOptions,
    fileName,
  });
  console.log("Typescript:", outputText);
};

await transformWithSwc();
await transpileWithTypescript();
