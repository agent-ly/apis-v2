import { Doc } from "../../common/interfaces/doc.interface.js";

export interface UserSettings extends Doc {
  _id: string;
  security: SettingsSecurity;
}

interface SettingsSecurity {
  password: string;
  email: ({ address: string } & SecurityConfiguration) | null;
  phone: ({ number: string } & SecurityConfiguration) | null;
  authenticator: ({ secret: string } & SecurityConfiguration) | null;
}

interface SecurityConfiguration {
  verified: boolean;
}
