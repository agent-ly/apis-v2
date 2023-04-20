import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectCollection } from "nestjs-super-mongodb";
import type { Collection } from "mongodb";

import { BotType } from "./enums/bot_type.enum.js";
import { Bot } from "./bot.entity.js";
import { COLLECTION_NAME } from "./bots.constants.js";

@Injectable()
export class BotsService {
  constructor(
    @InjectCollection(COLLECTION_NAME)
    private readonly collection: Collection<Bot>
  ) {}

  findAll() {
    return this.collection.find().toArray();
  }

  async create(payload: CreateBotPayload) {
    const now = new Date();
    const bot: Bot = {
      _id: payload.id,
      type: payload.type,
      name: payload.name,
      enabled: true,
      authenticated: true,
      frictioned: false,
      credentials: {
        roblosecurity: payload.roblosecurity,
        totpSecret: payload.totpSecret,
      },
      tradeLimits: [],
      createdAt: now,
      updatedAt: now,
    };
    await this.collection.insertOne(bot);
  }

  async delete(botId: number) {
    const { deletedCount } = await this.collection.deleteOne({ _id: botId });
    if (deletedCount === 0) {
      throw new NotFoundException("Bot not found.");
    }
  }

  async setEnabled(botId: number, enabled: boolean) {
    const { matchedCount, modifiedCount } = await this.collection.updateOne(
      { _id: botId },
      {
        $set: {
          enabled,
          ...(enabled ? { authenticated: true, frictioned: false } : {}),
        },
      }
    );
    if (matchedCount === 0) {
      throw new NotFoundException("Bot not found.");
    }
    if (modifiedCount === 0) {
      throw new BadRequestException(
        `Bot already ${enabled ? "enabled" : "disabled"}.`
      );
    }
  }

  findBotForDeposit(
    userId: number,
    ignoreList?: number[]
  ): Promise<Bot | null> {
    return this.collection.findOne({
      enabled: true,
      tradeLimits: {
        $not: { $elemMatch: { userId, expiresAt: { $gt: new Date() } } },
      },
      ...(ignoreList ? { _id: { $nin: ignoreList } } : {}),
    });
  }

  findBotForWithdraw(userId: number, botIds: number[]): Promise<Bot | null> {
    return this.collection.findOne({
      _id: { $in: botIds },
      enabled: true,
      tradeLimits: {
        $not: { $elemMatch: { userId, expiresAt: { $gt: new Date() } } },
      },
    });
  }
}

interface CreateBotPayload {
  type: BotType;
  id: number;
  name: string;
  roblosecurity: string;
  totpSecret?: string;
}
