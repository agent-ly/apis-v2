import { HttpException } from "@nestjs/common";
import { RobloxErrorHost, type RobloxError } from "roblox-proxy-nestjs";
import type { Result } from "errd";

type WithErrorFn<TReturn> = (
  error: RobloxError
) => TReturn | void | Promise<TReturn | void>;

export async function withError<TReturn>(
  result: Result<unknown, Error>,
  fn: WithErrorFn<TReturn>
) {
  const error = await RobloxErrorHost.normalize(result.unwrapErr());
  let fnResult: unknown | Promise<unknown> = fn(error);
  if (fnResult instanceof Promise) {
    fnResult = await fnResult;
  }
  if (fnResult === undefined) {
    throw new HttpException(error.message, error.statusCode);
  }
  return fnResult;
}
