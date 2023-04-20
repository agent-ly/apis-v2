import destr from "destr";

export interface GenericRobloxApiErorr {
  code: number;
  message: string;
  field?: unknown;
  fieldData?: unknown;
}

export interface GenericRobloxApiErrorResponse {
  errors: GenericRobloxApiErorr[];
}

export interface NormalizedRobloxApiError {
  statusCode: number;
  errorCode?: number;
  message: string;
  name?: string;
  url?: string;
  field?: unknown;
  fieldData?: unknown;
  headers?: Record<string, string>;
}

export interface NormalizedErrorLike {
  statusCode: number;
  errorCode?: number;
  message: string;
}

export class RobloxApiError extends Error {
  static isApiError(error: unknown): error is RobloxApiError {
    return error instanceof RobloxApiError;
  }

  static isAuthorizationError(statusCode: number, errorCode: number): boolean {
    return statusCode === 401 && (errorCode === 0 || errorCode === 9002);
  }

  static isModeratedError(statusCode: number, errorCode: number): boolean {
    return statusCode === 403 && errorCode === 9003;
  }

  static toNormalized(error: Error): Promise<NormalizedRobloxApiError> {
    if (RobloxApiError.isApiError(error)) {
      return error.normalize();
    }
    return Promise.resolve({ statusCode: 500, message: error.message });
  }

  cause: Response;

  constructor(response: Response) {
    super(`${response.status} ${response.statusText}`);
    this.name = "RobloxApiError";
    this.cause = response;
  }

  getStatus(): number {
    return this.cause.status;
  }

  async normalize(): Promise<NormalizedRobloxApiError> {
    const error = await this.#readBody();
    const parsed: NormalizedRobloxApiError = {
      url: this.cause.url.slice(this.cause.url.indexOf("?") + 1),
      statusCode: this.cause.status,
      errorCode: error.code,
      message: error.message,
    };
    if (error.field) {
      parsed.field = error.field;
    }
    if (error.fieldData) {
      parsed.fieldData = error.fieldData;
    }
    const headers = this.#readHeaders();
    if (headers) {
      parsed.headers = headers;
    }
    return parsed;
  }

  async #readBody(): Promise<GenericRobloxApiErorr> {
    if (isInvalidContent(this.cause)) {
      return { code: -1, message: "Error is unable to be parsed." };
    }

    const clone = this.cause.clone();
    const text = await clone.text();
    const body = destr(text);

    if (!isGenericErrorResponse(body)) {
      if (!isStringErrorResponse(body)) {
        return { code: -1, message: body.message ?? "Unknown error." };
      }
      return { code: -1, message: body };
    }

    const [error] = body.errors;
    return error;
  }

  #readHeaders(): Record<string, string> | undefined {
    const header = this.cause.headers.get("access-control-expose-headers");
    if (!header) {
      return;
    }
    const map: Record<string, string> = {};
    const headerNames = header.split(",");
    for (const headerName of headerNames) {
      const headerValue = this.cause.headers.get(headerName);
      if (headerValue) {
        map[headerName] = headerValue;
      }
    }
    return map;
  }
}

const isStringErrorResponse = (error: unknown): error is string =>
  typeof error === "string";

const isGenericErrorResponse = (
  error: unknown
): error is GenericRobloxApiErrorResponse =>
  typeof error === "object" && error !== null && "errors" in error;

const isInvalidContent = (response: Response): boolean => {
  const contentType = response.headers.get("content-type"),
    contentLength = response.headers.get("content-length");
  const invalidContentType =
    !contentType || !contentType.includes("application/json");
  const invalidContentLength =
    contentLength === undefined ||
    contentLength === "0" ||
    contentLength === "1";
  return invalidContentType || invalidContentLength;
};
