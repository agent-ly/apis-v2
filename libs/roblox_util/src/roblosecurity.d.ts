export function parseRoblosecurity(cookie: string): string;

export function appendRoblosecurity(
  cookie: string,
  roblosecurity: string
): string;

export function getRoblosecurityPrefix(roblosecurity: string): string;

export function setRoblosecurityPrefix(
  roblosecurity: string,
  newPrefix: string,
  oldPrefix?: string
): string;
