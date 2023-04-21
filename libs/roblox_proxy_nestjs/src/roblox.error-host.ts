import destr from "destr";

export interface RobloxError {
  statusCode: number;
  errorCode?: number;
  message: string;
  name?: string;
  url?: string;
  field?: unknown;
  fieldData?: unknown;
  headers?: Record<string, string>;
}

export type RobloxErrorLike = Pick<
  RobloxError,
  "statusCode" | "errorCode" | "message"
>;

export class RobloxErrorHost extends Error {
  static isRobloxErrorLike(error: unknown): error is RobloxErrorLike {
    return (
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      "message" in error
    );
  }

  static isRobloxError(error: unknown): error is RobloxError {
    return (
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      "message" in error &&
      "errorCode" in error
    );
  }

  static isAuthorizationError(statusCode: number, errorCode: number): boolean {
    return statusCode === 401 && (errorCode === 0 || errorCode === 9002);
  }

  static isModeratedError(statusCode: number, errorCode: number): boolean {
    return statusCode === 403 && errorCode === 9003;
  }

  static normalize(error: Error): Promise<RobloxError> {
    if (error instanceof RobloxErrorHost) {
      return error.normalize();
    }
    return Promise.resolve({ statusCode: 500, message: error.message });
  }

  cause: Response;

  constructor(response: Response) {
    super(`${response.status} ${response.statusText}`);
    this.name = "RobloxErrorHost";
    this.cause = response;
  }

  getStatus(): number {
    return this.cause.status;
  }

  getStatusText(): string {
    return this.cause.statusText;
  }

  async normalize(): Promise<RobloxError> {
    const body = await this.#readBody();
    const error: RobloxError = {
      url: this.cause.url.slice(this.cause.url.indexOf("?") + 1),
      statusCode: this.cause.status,
      errorCode: body.code,
      message: body.message,
    };
    if (body.field) {
      error.field = body.field;
    }
    if (body.fieldData) {
      error.fieldData = body.fieldData;
    }
    const headers = this.#getExposedHeaders();
    if (headers) {
      error.headers = headers;
    }
    return error;
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

  #getExposedHeaders(): Record<string, string> | undefined {
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

interface GenericRobloxApiErorr {
  code: number;
  message: string;
  field?: unknown;
  fieldData?: unknown;
}

interface GenericRobloxApiErrorResponse {
  errors: GenericRobloxApiErorr[];
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
