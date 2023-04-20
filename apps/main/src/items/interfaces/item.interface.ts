export interface Item {
  id: number;
  assetId: number;
  userId: number | string; // number for bots, string for users
  serial: number | null;
  name: string;
  value: number;
  rap: number;
  projected?: boolean;
}
