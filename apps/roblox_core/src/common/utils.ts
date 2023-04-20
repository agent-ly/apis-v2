import type { Result } from "errd";
import {
  RobloxApiError,
  type NormalizedRobloxApiError,
} from "roblox-proxy-nestjs";
import { HttpException } from "@nestjs/common";

type WithErrorFn<TReturn> = (
  error: NormalizedRobloxApiError
) => TReturn | void | Promise<TReturn | void>;

export async function withError<TReturn>(
  result: Result<unknown, Error>,
  fn: WithErrorFn<TReturn>
) {
  const error = await RobloxApiError.toNormalized(result.unwrapErr());
  let fnResult: unknown | Promise<unknown> = fn(error);
  if (fnResult instanceof Promise) {
    fnResult = await fnResult;
  }
  if (fnResult === undefined) {
    throw new HttpException(error.message, error.statusCode);
  }
  return fnResult;
}
