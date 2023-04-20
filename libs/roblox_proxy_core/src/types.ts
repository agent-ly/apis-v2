export interface ClientRequestInit {
  params?: Record<string, string>;
  method?: string;
  headers?: Record<string, string>;
  data?: unknown;
  roblosecurity?: string;
  session?: string;
}

export interface ClientRequestConfig {
  clientId?: string;
  proxyType?: ProxyType;
  proxyLocation?: ProxyLocation;
}

export interface RequestConfig {
  requestId?: string;
  proxyUrl?: string;
  proxyProvider?: ProxyProvider;
  proxyLocation?: ProxyLocation;
}

export interface ProxyLocation {
  countryCode: string;
  stateOrRegion?: string;
  cityOrProvince?: string;
}

export enum ProxyType {
  Dedicated = "dedicated",
  Residential = "residential",
}

export enum ProxyProvider {
  BrightData = "brightdata",
  PyProxy = "pyproxy",
}
