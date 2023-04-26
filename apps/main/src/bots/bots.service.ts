import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectCollection } from "nestjs-super-mongodb";
import { Collection, MongoServerError } from "mongodb";

import { BotType } from "./enums/bot_type.enum.js";
import { Bot } from "./bot.entity.js";
import { COLLECTION_NAME } from "./bots.constants.js";
import { CreateBotPayloadDto } from "./dto/create_bot_payload.dto.js";

@Injectable()
export class BotsService {
  constructor(
    @InjectCollection(COLLECTION_NAME)
    private readonly collection: Collection<Bot>
  ) {}

  findAll() {
    return this.collection.find().toArray();
  }

  async create(payload: CreateBotPayloadDto) {
    try {
      const now = new Date();
      const bot: Bot = {
        _id: payload.userId,
        type: payload.type,
        name: payload.username,
        enabled: true,
        authenticated: true,
        moderated: false,
        frictioned: false,
        credentials: {
          roblosecurity: payload.roblosecurity,
          roblosecret: payload.roblosecret,
        },
        createdAt: now,
        updatedAt: now,
      };
      await this.collection.insertOne(bot);
      return bot;
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) {
        throw new ConflictException({ message: "Bot already exists." });
      }
      throw new BadRequestException({ message: "Something went wrong." });
    }
  }

  async delete(botId: number) {
    const { deletedCount } = await this.collection.deleteOne({ _id: botId });
    if (deletedCount === 0) {
      throw new NotFoundException("Bot not found.");
    }
  }

  async toggle(botId: number, enabled: boolean) {
    const { matchedCount, modifiedCount } = await this.collection.updateOne(
      { _id: botId },
      { $set: { enabled } }
    );
    if (matchedCount === 0) {
      throw new NotFoundException("Bot not found.");
    }
    if (modifiedCount === 0) {
      throw new BadRequestException({
        message: `Bot already ${enabled ? "enabled" : "disabled"}.`,
      });
    }
  }

  findBotForDeposit(
    userId: number,
    ignoreList?: number[]
  ): Promise<Bot | null> {
    return this.collection.findOne({
      type: BotType.Storage,
      enabled: true,
      _id: { $nin: ignoreList ?? [] },
    });
  }

  findBotsForWithdraw(userId: number, botIds: number[]): Promise<Bot[]> {
    return this.collection
      .find({
        type: BotType.Storage,
        enabled: true,
        _id: { $in: botIds },
      })
      .toArray();
  }
}
