import { Inject, Injectable } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { timer } from "rxjs";
import { map, retry } from "rxjs/operators";
import { fromFetch } from "rxjs/fetch";

import solanaConfig from "./solana.config.js";
import type {
  JSONRPCRequest,
  JSONRPCResponse,
} from "./interfaces/rpc.interface.js";
import type { Block } from "./interfaces/block.interface.js";
import { SolanaError } from "./solana.error.js";

@Injectable()
export class SolanaService {
  private static readonly FUTURE_BLOCK_DELAY = 1e3 * 5; // 5 seconds

  constructor(
    @Inject(solanaConfig.KEY)
    private readonly config: ConfigType<typeof solanaConfig>
  ) {}

  getFutureBlock$(futureSlot: number) {
    return this.getBlock$(futureSlot).pipe(
      retry({
        count: 5,
        delay: (error) => {
          if (
            error instanceof SolanaError &&
            error.code === SolanaError.ERROR_CODES.BLOCK_NOT_AVAILABLE
          ) {
            return timer(SolanaService.FUTURE_BLOCK_DELAY);
          }
          throw error;
        },
      })
    );
  }

  getBlock$(slot: number) {
    return this.request$<Block>("getBlock", [
      slot,
      {
        commitment: "finalized",
        transactionDetails: "none",
        rewards: false,
      },
    ]);
  }

  getSlot$() {
    return this.request$<number>("getSlot", [{ commitment: "finalized" }]);
  }

  private request$<TResult = unknown>(method: string, params: unknown) {
    if (!this.config.rpcUrl) {
      throw new Error("SOLANA_RPC_URL is not set");
    }
    const request: JSONRPCRequest = {
      id: 1,
      jsonrpc: "2.0",
      method,
      params,
    };
    return fromFetch<JSONRPCResponse<TResult>>(this.config.rpcUrl, {
      method: "POST",
      body: JSON.stringify(request),
      headers: { "Content-Type": "application/json" },
      selector: (response) => response.json(),
    }).pipe(
      map((response) => {
        if ("error" in response) {
          throw new SolanaError(response.error.code, response.error.message);
        }
        return response.result;
      })
    );
  }
}
