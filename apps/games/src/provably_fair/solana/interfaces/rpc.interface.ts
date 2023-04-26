export interface JSONRPCRequest {
  id: number;
  jsonrpc: "2.0";
  method: string;
  params: unknown;
}

interface JSONRPCError {
  code: number;
  message: string;
}

interface JSONRPCSuccessResponse<TResult> {
  id: number;
  jsonrpc: "2.0";
  result: TResult;
}

interface JSONRPCErrorResponse {
  id: number;
  jsonrpc: "2.0";
  error: JSONRPCError;
}

export type JSONRPCResponse<TResult> =
  | JSONRPCSuccessResponse<TResult>
  | JSONRPCErrorResponse;
