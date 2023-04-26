import { nhttp } from "nhttp-land";

import { logger } from "./logger.js";
import { isPayloadMethod, removeHeaders } from "./common_util.js";
import { resolveProxyAgent } from "./proxy_util.js";
import { getRequestUrl } from "./request_util.js";
import {
  createUpstreamContext,
  finalizeUpstreamContext,
  fromUpstream,
  prepareUpstream,
} from "./upstream_util.js";
import kleur from "kleur";

const app = nhttp();

const ignoredRequestHeaders = new Set(["host", "connection", "content-length"]);

const ignoredCustomHeaders = new Set([
  "x-request-id",
  "x-use-proxy",
  "x-proxy-url",
  "x-proxy-provider",
  "x-proxy-location",
]);

let payloadRequestIds = 0;

app.any("/", async ({ request }) => {
  const requestUrl = getRequestUrl(request.url);
  const requestMethod = request.method;
  const requestHeaders = request.headers;
  removeHeaders(requestHeaders, ignoredRequestHeaders);

  let startedAt = Date.now();
  let requestId = requestHeaders.get("x-request-id") ?? "default";
  if (requestId === "default" && isPayloadMethod(requestMethod)) {
    requestId += `_${payloadRequestIds++}`;
  }
  logger.log(`[request-${requestId}] ${requestMethod} ${requestUrl}`);
  const agent = resolveProxyAgent(requestId, requestHeaders);
  removeHeaders(requestHeaders, ignoredCustomHeaders);
  const context = createUpstreamContext(
    requestUrl,
    requestMethod,
    requestHeaders
  );
  finalizeUpstreamContext(context, requestId, agent);
  await prepareUpstream(request, context);
  const response = await fromUpstream(context);
  const duration = Date.now() - startedAt;
  logger[response.status >= 400 ? "error" : "log"](
    `[request-${requestId}] ${response.status} ${response.statusText} (${duration}ms)`
  );
  return response;
});

await app.listen(8070);

console.log("⏩ Listening on port 8070");
