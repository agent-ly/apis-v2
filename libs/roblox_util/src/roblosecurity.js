const ROBLOSECURITY_PREFIX =
  "WARNING:-DO-NOT-SHARE-THIS.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items.";

const robloSecurityPrefixRE = /_\|(.+)\|_/;
const roblosecurityCookieRE = /.ROBLOSECURITY=(.*?);/;

/** @param {string} cookie */
export const parseRoblosecurity = (cookie) =>
  cookie.match(roblosecurityCookieRE)?.[1];

/**
 * @param {string | undefined} cookie
 * @param {string} roblosecurity
 * */
export const appendRoblosecurity = (cookie, roblosecurity) =>
  cookie
    ? `${cookie}; .ROBLOSECURITY=${roblosecurity}`
    : `.ROBLOSECURITY=${roblosecurity}`;

/** @param {string} roblosecurity */
export const getRoblosecurityPrefix = (roblosecurity) =>
  roblosecurity.match(robloSecurityPrefixRE)?.[1];

/**
 * @param {string} roblosecurity
 * @param {string} newPrefix
 * @param {string} oldPrefix
 */
export const setRoblosecurityPrefix = (
  roblosecurity,
  newPrefix,
  oldPrefix = ROBLOSECURITY_PREFIX
) => roblosecurity.replace(oldPrefix, newPrefix);
