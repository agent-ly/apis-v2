export interface PageQuery {
  sortOrder?: string;
  limit?: number;
  cursor?: string;
}

export interface PageResponse<TData> {
  previousPageCursor: string | null;
  nextPageCursor: string | null;
  data: TData[];
}

export type GetPageFn<TData> = (
  cursor?: string
) => Promise<PageResponse<TData>>;

export interface AsyncIterablePageCursor<TData> extends AsyncIterable<TData[]> {
  toArray(): Promise<TData[]>;
}
