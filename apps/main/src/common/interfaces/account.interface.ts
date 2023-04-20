import { Doc } from "./doc.interface.js";

export interface Account extends Doc<number> {
  enabled: boolean;
  authenticated: boolean;
  moderated: boolean;
  frictioned: boolean;
  credentials: {
    roblosecurity: string;
    totpSecret?: string;
  };
}
