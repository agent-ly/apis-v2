import { createHash } from "node:crypto";

import type { ProxyLocation } from "./types.js";

export interface ClientSession {
  clientId: string;
  proxyLocation: ProxyLocation;
}

const encodedRE = /^([a-f0-9]{8})-(.+)$/;

const encodePart = (str: string) => str.toLowerCase().replace(/\s/g, "_");

const encodeLocation = (
  countryCode: string,
  stateOrRegion = "none",
  cityOrProvince = "none"
) => {
  if (!countryCode) {
    throw new Error("Country is required");
  }
  countryCode = encodePart(countryCode);
  if (stateOrRegion) {
    stateOrRegion = encodePart(stateOrRegion);
  }
  if (cityOrProvince) {
    cityOrProvince = encodePart(cityOrProvince);
  }
  return `${countryCode}-${stateOrRegion}-${cityOrProvince}`;
};

export const generateClientId = (data: string) =>
  createHash("sha256").update(data).digest("hex").slice(0, 8);

export const encodeSession = (
  clientId: string,
  countryCode: string,
  stateOrRegion?: string,
  cityOrProvince?: string
) =>
  `${clientId}-${encodeLocation(countryCode, stateOrRegion, cityOrProvince)}`;

export const decodeSession = (session: string): ClientSession => {
  const [clientId, ...proxyLocation] = session.split("-");
  const [countryCode, stateOrRegion, cityOrProvince] = proxyLocation;
  return {
    clientId,
    proxyLocation: { countryCode, stateOrRegion, cityOrProvince },
  };
};

export const isSession = (session: string) => encodedRE.test(session);
