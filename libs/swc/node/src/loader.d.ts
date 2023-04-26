export interface ResolveContext {
  conditions: string[];
  importAssertions: Record<string, any>;
  parentURL: string;
}

export interface ResolveResult {
  format?: string | null;
  importAssertions?: Record<string, any>;
  shortCircuit?: boolean;
  url: string;
}

export type NextResolveFn = (
  specifier: string,
  context: ResolveContext
) => Promise<ResolveResult>;

export type ResolveFn = (
  specifier: string,
  context: ResolveContext,
  nextResolve: NextResolveFn
) => Promise<ResolveResult>;

export interface LoadContext {
  conditions: string[];
  format?: string | null;
  importAssertions: Record<string, any>;
}

export interface LoadResult {
  format: string;
  shortCircuit?: boolean;
  source: string | ArrayBuffer | SharedArrayBuffer | Uint8Array;
}

export type NextLoadFn = (
  url: string,
  context: LoadContext
) => Promise<LoadResult>;

export type LoadFn = (
  url: string,
  context: LoadContext,
  nextLoad: NextLoadFn
) => Promise<LoadResult>;
