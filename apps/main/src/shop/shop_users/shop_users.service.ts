import { InjectCollection } from "nestjs-super-mongodb";
import type { Collection } from "mongodb";

import { ShopUser } from "./shop_user.entity.js";
import { COLLECTION_NAME } from "./shop_users.constants.js";

// TODO: Scan for users that have not been authenticated in a while

export class ShopUsersService {
  constructor(
    @InjectCollection(COLLECTION_NAME)
    private readonly collection: Collection<ShopUser>
  ) {}

  async create(payload: CreateShopUserPayload): Promise<void> {
    const now = new Date();
    const shopUser: ShopUser = {
      _id: payload.userId,
      enabled: true,
      authenticated: true,
      moderated: false,
      frictioned: false,
      credentials: {
        roblosecurity: payload.roblosecurity,
        totpSecret: payload.totpSecret,
      },
      updatedAt: now,
      createdAt: now,
    };
    await this.collection.insertOne(shopUser);
  }

  async createOrUpdate(payload: CreateShopUserPayload): Promise<void> {
    const user = await this.findById(payload.userId);
    if (!user) {
      await this.create({
        userId: payload.userId,
        roblosecurity: payload.roblosecurity,
        totpSecret: payload.totpSecret,
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
        payload.totpSecret &&
        user.credentials.totpSecret !== payload.totpSecret
      ) {
        user.credentials.totpSecret = payload.totpSecret;
      }
      await this.save(user);
    }
  }

  async save(shopUser: ShopUser): Promise<void> {
    shopUser.updatedAt = new Date();
    await this.collection.updateOne({ _id: shopUser._id }, { $set: shopUser });
  }

  findById(id: number): Promise<ShopUser | null> {
    return this.collection.findOne({ _id: id });
  }
}

interface CreateShopUserPayload {
  userId: number;
  roblosecurity: string;
  totpSecret?: string;
}
