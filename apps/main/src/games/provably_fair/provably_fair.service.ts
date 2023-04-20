import { Injectable } from "@nestjs/common";

import {
  divideBigInts,
  getHex,
  getSha256,
  getHmacSha256,
} from "./provably_fair.util.js";

const COINFLIP_OUTCOME_DECIMALS = 8;

@Injectable()
export class ProvablyFairService {
  generateServerSeed(): string {
    return getHex();
  }

  getHash(data: string): string {
    return getSha256(data);
  }

  getServerHashChain(serverSeed: string, length: number): string[] {
    const serverHashes: string[] = [];
    let serverHash = serverSeed;
    while (serverHashes.length < length) {
      serverHash = getSha256(serverHash);
      serverHashes.push(serverHash);
    }
    serverHashes.reverse();
    return serverHashes;
  }

  getPlayerVersusPlayerHash(serverSeed: string, clientSeed: string): string {
    return getHmacSha256(serverSeed, clientSeed);
  }

  getMultiplayerHash(serverHash: string, clientSeed: string): string {
    return getHmacSha256(serverHash, clientSeed);
  }

  getCoinflipOutcome(hash: string): number {
    const numerator = BigInt(`0x${hash}`);
    const denominator = 2n ** 256n;
    const result = divideBigInts(
      numerator,
      denominator,
      COINFLIP_OUTCOME_DECIMALS
    );
    return result;
  }

  getRouletteOutcome(hash: string): number {
    const numberOfSlots = 15;
    const numerator = BigInt(numberOfSlots) * BigInt(`0x${hash}`);
    const denominator = 2n ** 256n;
    const index = divideBigInts(numerator, denominator);
    return index;
  }
}
