import createHttpsAgent, { type HttpsProxyAgent } from "https-proxy-agent";
import { ProxyProvider, type ProxyLocation } from "roblox-proxy-core/types";

import { logger } from "./logger.js";

const {
  BRIGHTDATA_DEFAULT_USERNAME,
  BRIGHTDATA_DEFAULT_PASSWORD,
  BRIGHTDATA_NA_USERNAME,
  BRIGHTDATA_NA_PASSWORD,
  BRIGHTDATA_OTHER_USERNAME,
  BRIGHTDATA_OTHER_PASSWORD,
  BRIGHTDATA_URL,
  PYPROXY_USERNAME,
  PYPROXY_PASSWORD,
  PYPROXY_URL,
} = process.env;

const agents = new Map<string, HttpsProxyAgent>();

type BuildProxyFn = (requestId: string, proxyLocation: ProxyLocation) => string;

const proxyBuilders = new Map<ProxyProvider, BuildProxyFn>([
  [
    ProxyProvider.BrightData,
    (requestId: string, proxyLocation: ProxyLocation) => {
      const [proxyUsername, proxyPassword] =
        requestId === "default"
          ? [BRIGHTDATA_DEFAULT_USERNAME, BRIGHTDATA_DEFAULT_PASSWORD]
          : proxyLocation.countryCode === "us"
          ? [BRIGHTDATA_NA_USERNAME, BRIGHTDATA_NA_PASSWORD]
          : [BRIGHTDATA_OTHER_USERNAME, BRIGHTDATA_OTHER_PASSWORD];
      let proxyAuth = `${proxyUsername}-country-${proxyLocation.countryCode}`;
      if (proxyLocation.countryCode === "us" && proxyLocation.cityOrProvince) {
        proxyAuth += `-city-${proxyLocation.cityOrProvince}`;
      }
      if (requestId !== "default") {
        proxyAuth += `-session-${requestId}`;
      }
      proxyAuth += `:${proxyPassword}`;
      const proxyUrl = `http://${proxyAuth}@${BRIGHTDATA_URL}`;
      return proxyUrl;
    },
  ],
  [
    ProxyProvider.PyProxy,
    (requestId: string, proxyLocation: ProxyLocation) => {
      let proxyAuth = `${PYPROXY_USERNAME}-region-${proxyLocation.countryCode}`;
      if (proxyLocation.countryCode === "us" && proxyLocation.stateOrRegion) {
        proxyAuth += `-st-${proxyLocation.stateOrRegion}`;
        if (proxyLocation.cityOrProvince) {
          proxyAuth += `-city-${proxyLocation.cityOrProvince}`;
        }
      }
      if (requestId !== "default") {
        proxyAuth += `-session-${requestId}-sessTime-5`;
      }
      proxyAuth += `:${PYPROXY_PASSWORD}`;
      const proxyUrl = `http://${proxyAuth}@${PYPROXY_URL}`;
      return proxyUrl;
    },
  ],
]);

export const resolveProxyAgent = (
  requestId: string,
  requestHeaders: Headers
) => {
  if (requestHeaders.has("x-use-proxy")) {
    logger.debug(`[request-${requestId}] Proxy requested.`);
    let proxyUrl = requestHeaders.get("x-proxy-url");
    if (!proxyUrl) {
      const proxyProvider = requestHeaders.get("x-proxy-provider");
      const b64ProxyLocation = requestHeaders.get("x-proxy-location");
      if (proxyProvider && b64ProxyLocation) {
        if (
          proxyProvider !== ProxyProvider.BrightData &&
          proxyProvider !== ProxyProvider.PyProxy
        ) {
          throw new Error("Invalid proxy provider.");
        }
        logger.debug(
          `[request-${requestId}] Proxy identified: ${proxyProvider}`
        );
        const proxyLocation = JSON.parse(
          Buffer.from(b64ProxyLocation, "base64").toString("utf-8")
        );
        proxyUrl = resolveProxyUrl(requestId, proxyProvider, proxyLocation);
      } else {
        const message = "Missing proxy details.";
        logger.error(`[request-${requestId}] ${message}`);
        throw new Error(message);
      }
    }
    if (proxyUrl) {
      logger.debug(`[request-${requestId}] Proxy resolved.`);
      return getOrCreateProxyAgent(proxyUrl);
    }
  }
};

const resolveProxyUrl = (
  requestId: string,
  proxyProvider: ProxyProvider,
  proxyLocation: ProxyLocation
) => {
  const proxyBuilder = proxyBuilders.get(proxyProvider);
  if (!proxyBuilder) {
    throw new Error(`Invalid proxy provider: ${proxyProvider}`);
  }
  return proxyBuilder(requestId, proxyLocation);
};

const getOrCreateProxyAgent = (proxyUrl: string) => {
  let agent = agents.get(proxyUrl);
  if (!agent) {
    agent = createHttpsAgent(proxyUrl);
    agents.set(proxyUrl, agent);
  }
  return agent;
};
