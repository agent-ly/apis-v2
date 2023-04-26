export type PageQuerySortOrder = "Asc" | "Desc";

export type PageQueryLimit = 10 | 25 | 50 | 100;

export interface PageQuery {
  limit?: PageQueryLimit;
  sortOrder?: PageQuerySortOrder;
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

export function createPageCursor<TData>(
  getPage: GetPageFn<TData>
): AsyncIterablePageCursor<TData>;
