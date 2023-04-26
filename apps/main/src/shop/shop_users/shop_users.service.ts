import { InjectCollection } from "nestjs-super-mongodb";
import type { Collection } from "mongodb";

import { ShopUser } from "./shop_user.entity.js";
import { COLLECTION_NAME } from "./shop_users.constants.js";
import { ShopUserType } from "./enums/shop_user_type.enum.js";

// TODO: Scan for users that have not been authenticated in a while

export class ShopUsersService {
  constructor(
    @InjectCollection(COLLECTION_NAME)
    private readonly collection: Collection<ShopUser>
  ) {}

  onModuleInit() {
    this.collection.createIndexes([{ key: { _id: 1, type: 1 } }]);
  }

  async create(payload: CreateOrUpsertShopUserPayload): Promise<void> {
    const now = new Date();
    const user: ShopUser = {
      _id: payload.userId,
      type: payload.type,
      enabled: true,
      authenticated: true,
      moderated: false,
      frictioned: false,
      credentials: {
        roblosecurity: payload.roblosecurity,
        roblosecret: payload.roblosecret,
      },
      updatedAt: now,
      createdAt: now,
    };
    await this.collection.insertOne(user);
  }

  async upsert(payload: CreateOrUpsertShopUserPayload): Promise<void> {
    const user = await this.findByIdAndType(payload.type, payload.userId);
    if (!user) {
      await this.create({
        type: payload.type,
        userId: payload.userId,
        roblosecurity: payload.roblosecurity,
        roblosecret: payload.roblosecret,
      });
    } else {
      if (user.authenticated !== true) {
        user.authenticated = true;
      }
      if (user.moderated !== false) {
        user.moderated = false;
      }
      if (user.credentials.roblosecurity !== payload.roblosecurity) {
        user.credentials.roblosecurity = payload.roblosecurity;
      }
      if (
        payload.roblosecret &&
        user.credentials.roblosecret !== payload.roblosecret
      ) {
        user.credentials.roblosecret = payload.roblosecret;
      }
      await this.collection.updateOne(
        { _id: user._id },
        {
          $set: {
            authenticated: user.authenticated,
            moderated: user.moderated,
            ["credentials.roblosecurity"]: user.credentials.roblosecurity,
            ["credentials.roblosecret"]: user.credentials.roblosecret,
          },
          $currentDate: { updatedAt: true },
        }
      );
    }
  }

  async save(user: ShopUser): Promise<void> {
    user.updatedAt = new Date();
    await this.collection.updateOne({ _id: user._id }, { $set: user });
  }

  findByIdAndType(
    type: ShopUserType,
    userId: number
  ): Promise<ShopUser | null> {
    return this.collection.findOne({
      _id: userId,
      type,
    });
  }
}

interface CreateOrUpsertShopUserPayload {
  type: ShopUserType;
  userId: number;
  roblosecurity: string;
  roblosecret?: string;
}
