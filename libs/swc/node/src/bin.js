// @ts-check

import { spawn, spawnSync } from "node:child_process";
import { argv } from "node:process";
import mri from "mri";
import { watch } from "chokidar";

import { createLogger } from "./logger.js";

const args = mri(argv.slice(2), {
  boolean: ["env", "quiet"],
  string: ["watch"],
  alias: {
    env: "E",
    quiet: "q",
    watch: "w",
  },
});
const entryFile = args._[0];
if (!entryFile) {
  throw new Error("Entry file not specified.");
}

/** @type {[string, string[]]} */
const spawnArgs = ["node", ["--no-warnings", "--loader", "swc-node/loader"]];
if (args.env) {
  spawnArgs[1].push("--require", "dotenv/config");
}
spawnArgs[1].push(entryFile);

if (args.watch) {
  handleWatch();
} else {
  handle();
}

function handle() {
  const { status } = spawnSync(...spawnArgs, { stdio: "inherit" });
  if (status) {
    process.exit(status);
  }
}

function handleWatch() {
  const logger = createLogger(args.quiet);
  /** @type {import("child_process").ChildProcess | undefined} */
  let child;
  const killChild = (verbose = true) => {
    if (!child) {
      return logger.warn("Child process not spawned.");
    }
    child.kill();
    if (verbose) {
      logger.debug(`Killed child process ${child.pid}.`);
    }
    child = undefined;
  };
  const spawnChild = () => {
    if (child) {
      return logger.warn("Child process already spawned.");
    }
    child = spawn(...spawnArgs, { stdio: "inherit" });
    logger.debug(`Spawned child process ${child.pid}.`);
  };
  createWatcher(args.watch, {
    onReady: () => {
      console.clear();
      logger.log(`Watching files: ${args.watch}`);
      spawnChild();
    },
    onChange: () => {
      console.clear();
      logger.log("Change detected, restarting...");
      killChild();
      spawnChild();
    },
    onExit: () => killChild(false),
  });
}

/**
 * @typedef {() => void} WatcherCallback
 * @typedef {object} WatcherOptions
 * @property {WatcherCallback} onReady
 * @property {WatcherCallback} onChange
 * @property {WatcherCallback} onExit
 * @param {string | string[]} paths
 * @param {WatcherOptions} options
 */
function createWatcher(paths, { onReady, onChange, onExit }) {
  const watcher = watch(paths, { ignoreInitial: true });
  watcher.on("ready", onReady);
  watcher.on("change", onChange);
  process.on("exit", onExit);
  return watcher;
}
