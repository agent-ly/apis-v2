import {
  ProxyType,
  ProxyProvider,
  type ClientRequestInit,
  type ClientRequestConfig,
} from "../types.js";
import { ProxyRequestBuilder } from "./builders/proxy_request.js";
import {
  DEFAULT_HEADERS,
  DEFAULT_METHOD,
  DEFAULT_PROXY_LOCATION,
  DEFAULT_PROXY_TYPE,
} from "./defaults.js";

export interface RequestOptions {
  init?: ClientRequestInit;
  config?: ClientRequestConfig | false;
}

export async function request(url: string, options: RequestOptions = {}) {
  const proxyRequest = new ProxyRequestBuilder();
  proxyRequest.url(url);
  if (!options?.init) {
    options.init = {};
  }
  options.init.method = options.init.method ?? DEFAULT_METHOD;
  options.init.headers = { ...DEFAULT_HEADERS, ...options.init.headers };
  if (options?.init) {
    if (options.init.method) {
      proxyRequest.method(options.init.method);
    }
    if (options.init.headers) {
      proxyRequest.headers(options.init.headers);
    }
    if (options.init.data) {
      proxyRequest
        .header("Content-Type", "application/json")
        .body(JSON.stringify(options.init.data));
    }
    if (options.init.roblosecurity) {
      proxyRequest.header(
        "Cookie",
        `.ROBLOSECURITY=${options.init.roblosecurity};`
      );
    }
  }
  if (options?.config !== false) {
    if (!options.config) {
      options.config = {};
    }
    if (!options.config.proxyType) {
      options.config.proxyType = DEFAULT_PROXY_TYPE;
    }
    if (!options.config.proxyLocation) {
      options.config.proxyLocation = { ...DEFAULT_PROXY_LOCATION };
    }
    proxyRequest.useProxy();
    if (options.config.clientId) {
      proxyRequest.requestId(options.config.clientId);
    }
    if (options.config.proxyType) {
      const proxyProvider =
        options.config.proxyType === ProxyType.Dedicated
          ? ProxyProvider.BrightData
          : ProxyProvider.PyProxy;
      proxyRequest.proxyProvider(proxyProvider);
    }
    if (options.config.proxyLocation) {
      proxyRequest.proxyLocation(options.config.proxyLocation);
    }
  }
  const request = proxyRequest.build();
  const response = await fetch(request);
  return response;
}
