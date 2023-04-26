import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectCollection } from "nestjs-super-mongodb";
import type { Collection } from "mongodb";
import { Secret } from "otpauth";

import { UserSettings } from "./user_settings.entity.js";
import { COLLECTION_NAME } from "./user_settings.constants.js";

@Injectable()
export class UserSettingsService {
  constructor(
    @InjectCollection(COLLECTION_NAME)
    private readonly collection: Collection<UserSettings>
  ) {}

  async create(userId: string, password: string) {
    const now = new Date();
    const settings: UserSettings = {
      _id: userId,
      security: {
        password,
        email: null,
        phone: null,
        authenticator: null,
      },
      createdAt: now,
      updatedAt: now,
    };
    await this.collection.insertOne(settings);
  }

  findById(userId: string) {
    return this.collection.findOne({ _id: userId });
  }

  async findByIdOrThrow(userId: string) {
    const settings = await this.findById(userId);
    if (!settings) {
      throw new NotFoundException("User settings not found.");
    }
    return settings;
  }

  async getPassword(userId: string) {
    const settings = await this.findByIdOrThrow(userId);
    return settings.security.password;
  }

  async changePassword(userId: string, password: string) {
    const { matchedCount, modifiedCount } = await this.collection.updateOne(
      {
        _id: userId,
      },
      {
        $set: { "security.password": password },
        $currentDate: { updatedAt: true },
      }
    );
    if (matchedCount === 0) {
      throw new NotFoundException({ message: "User settings not found." });
    }
    if (modifiedCount === 0) {
      throw new BadRequestException({ message: "Password not changed." });
    }
  }

  async setupAuthenticator(settings: UserSettings) {
    const secret = new Secret().base32;
    await this.collection.updateOne(
      { _id: settings._id },
      {
        $set: {
          "security.authenticator": { verified: false, secret },
        },
        $currentDate: { updatedAt: true },
      }
    );
    return secret;
  }

  async verifyAuthenticator(settings: UserSettings) {
    await this.collection.updateOne(
      { _id: settings._id },
      {
        $set: { "security.authenticator.verified": true },
        $currentDate: { updatedAt: true },
      }
    );
  }

  async removeAuthenticator(settings: UserSettings) {
    await this.collection.updateOne(
      { _id: settings._id },
      {
        $set: { "security.authenticator": null },
        $currentDate: { updatedAt: true },
      }
    );
  }
}
