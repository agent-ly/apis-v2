import { ProxyLocation, ProxyProvider } from "../../types.js";
import { RequestBuilder } from "./request.js";

const BASE_URL = "http://localhost:8070/?";

export class ProxyRequestBuilder extends RequestBuilder {
  url(url: string) {
    return super.url(BASE_URL + url);
  }

  requestId(requestId: string) {
    return this.header("X-Request-ID", requestId);
  }

  useProxy() {
    return this.header("X-Use-Proxy", "true");
  }

  proxyUrl(proxyUrl: string) {
    return this.header("X-Proxy-URL", proxyUrl);
  }

  proxyProvider(proxyProvider: ProxyProvider) {
    return this.header("X-Proxy-Provider", proxyProvider);
  }

  proxyLocation(proxyLocation: ProxyLocation) {
    const serialized = Buffer.from(JSON.stringify(proxyLocation)).toString(
      "base64"
    );
    return this.header("X-Proxy-Location", serialized);
  }
}
