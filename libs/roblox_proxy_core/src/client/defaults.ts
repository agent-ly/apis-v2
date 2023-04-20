import { ProxyType } from "../types.js";

export const DEFAULT_METHOD = "GET";
export const DEFAULT_HEADERS = {
  Accept: "*/*",
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36 OPR/93.0.0.0",
  Origin: "https://www.roblox.com",
  Referer: "https://www.roblox.com/",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-site",
};
export const DEFAULT_CLIENT_ID = "default";
export const DEFAULT_PROXY_TYPE = ProxyType.Dedicated;
export const DEFAULT_PROXY_LOCATION = { countryCode: "us" };
