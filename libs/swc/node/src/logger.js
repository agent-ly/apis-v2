import kleur from "kleur";

/**
 * @typedef {"log" | "warn" | "error" | "debug"} LogLevel
 * @typedef {(message: string) => void} LogFn
 * @type {(quiet?: boolean) => Record<LogLevel, LogFn>}
 */
export const createLogger = (quiet) => ({
  log: (message) => !quiet && console.log(kleur.green(message)),
  debug: (message) => !quiet && console.log(kleur.gray(message)),
  warn: (message) => console.warn(kleur.yellow(message)),
  error: (message) => console.error(kleur.red(message)),
});
