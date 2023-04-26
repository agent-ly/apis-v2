export type ControlledResponse<TData = unknown> =
  | {
      ok: true;
      data: TData;
    }
  | {
      ok: false;
      error: string;
    };

export interface Collectible {
  userAssetId: number;
  assetId: number;
  serialNumber: number | null;
  name: string;
  recentAveragePrice: number;
}

export type GetUserCollectiblesResponse = ControlledResponse<{
  nextPageCursor: string | null;
  data: Collectible[];
}>;

export interface AuthenticatedUser {
  id: number;
  name: string;
  displayName: string;
}

export type GetAuthenticatedUserResponse =
  ControlledResponse<AuthenticatedUser>;

export type CanAuthenticatedUserTradeResponse =
  | {
      ok: true;
    }
  | {
      ok: false;
      error: string;
      message: string;
    };
