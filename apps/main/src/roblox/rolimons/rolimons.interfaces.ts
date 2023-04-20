interface RolimonsApiError {
  success: false;
  message: string;
  code: number;
}

interface RolimonsApiSuccess {
  success: true;
}

export type RolimonsApiResponse<T> =
  | (RolimonsApiSuccess & T)
  | RolimonsApiError;

export interface RolimonsItemDetailsResponse {
  item_count: number;
  items: {
    [assetId: string]: [
      name: string,
      acronym: string,
      rap: number,
      value: number,
      display: number,
      demand: unknown,
      trend: unknown,
      isProjected: -1 | 1,
      isHyped: -1 | 1,
      isRare: -1 | 1
    ];
  };
}
