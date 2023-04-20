import { createHash, createHmac, randomBytes } from "node:crypto";

export const getHex = (size = 32): string => randomBytes(size).toString("hex");

export const getHash = (algorithm: string, data: string): string =>
  createHash(algorithm).update(data).digest("hex");

export const getHmac = (
  algorithm: string,
  data: string,
  salt: string
): string => createHmac(algorithm, salt).update(data).digest("hex");

export const getSha256 = (data: string): string => getHash("sha256", data);

export const getHmacSha256 = (salt: string, data: string): string =>
  getHmac("sha256", salt, data);

export const divideBigInts = (
  numerator: bigint,
  denominator: bigint,
  decimals: number = 0
) =>
  Number((10n ** BigInt(decimals) * numerator) / denominator) / 10 ** decimals;
