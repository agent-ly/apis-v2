import type { HttpsProxyAgent } from "https-proxy-agent";
import nodeFetch, {
  BodyInit as NodeFetchBodyInit,
  RequestInit as NodeFetchRequestInit,
  Response as NodeFetchResponse,
} from "node-fetch";

import { logger } from "./logger.js";
import { isPayloadMethod, removeHeaders } from "./common_util.js";

const REQUEST_TIMEOUT = 2e4;

const csrfTokens = new Map<string, string>();

const ignoredResponseHeaders = new Set([
  "content-length",
  "content-encoding",
  "transfer-encoding",
  "connection",
  "keep-alive",
]);

interface UpstreamContext {
  url: string;
  init: {
    method: string;
    headers: Headers;
    body?: NodeFetchBodyInit;
    agent?: HttpsProxyAgent;
    signal?: AbortSignal;
  };
  vars: {
    requestId?: string;
    csrfRetries?: number;
  };
}

export const createUpstreamContext = (
  url: string,
  method: string,
  headers: Headers
): UpstreamContext => ({
  url,
  init: { method, headers },
  vars: {},
});

export const finalizeUpstreamContext = (
  context: UpstreamContext,
  requestId: string,
  agent?: HttpsProxyAgent
) => {
  context.vars.requestId = requestId;
  if (agent) {
    context.init.agent = agent;
  }
};

export const fromUpstream = async (
  context: UpstreamContext
): Promise<Response> => {
  const response = await fetchUpstream(context);
  const status = response.status,
    statusText = response.statusText;
  const headers = new Headers(response.headers);
  removeHeaders(headers, ignoredResponseHeaders);
  const body = response.body ? await response.blob() : undefined;
  return new Response(body, { status, statusText, headers });
};

export const prepareUpstream = async (
  body: Body,
  context: UpstreamContext
): Promise<void> => {
  if (
    context.vars.requestId &&
    isPayloadMethod(context.init.method) &&
    context.init.headers.has("x-csrf-token") === false
  ) {
    const csrfToken = csrfTokens.get(context.vars.requestId);
    if (csrfToken) {
      context.init.headers.set("x-csrf-token", csrfToken);
      logger.debug(
        `[request-${context.vars.requestId}] Using CSRF token: ${csrfToken}`
      );
    }
  }
  if (context.init.headers.has("content-type")) {
    context.init.body = await body.blob();
  }
};

const fetchUpstream = async (
  context: UpstreamContext
): Promise<NodeFetchResponse> => {
  let response = await fetchWithTimeout(context.url, context.init);
  if (response.status === 403) {
    const csrfToken = response.headers.get("x-csrf-token");
    if (csrfToken && context.vars.requestId) {
      if (context.vars.csrfRetries === undefined) {
        context.vars.csrfRetries = 0;
      }
      if (++context.vars.csrfRetries < 3) {
        csrfTokens.set(context.vars.requestId, csrfToken);
        context.init.headers.set("x-csrf-token", csrfToken);
        logger.debug(
          `[request-${context.vars.requestId}] Retrying with CSRF token: ${csrfToken}`
        );
        return fetchUpstream(context);
      }
    }
  }
  return response;
};

const fetchWithTimeout = async (
  url: string,
  init: NodeFetchRequestInit,
  timeout = REQUEST_TIMEOUT
) => {
  const controller = new AbortController();
  init.signal = controller.signal;
  const timeoutId = setTimeout(() => {
    logger.debug(`[fetch] Request timed out: ${url}`);
    controller.abort();
  }, timeout);
  try {
    const response = await nodeFetch(url, init);
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
};
