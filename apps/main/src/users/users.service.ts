import {
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from "@nestjs/common";
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter";
import { InjectCollection } from "nestjs-super-mongodb";
import type { Collection, Filter, UpdateFilter } from "mongodb";
import { nanoid } from "nanoid";

import { WagerStatus } from "../wagers/enums/wager_status.enum.js";
import { WagerResult } from "../wagers/enums/wager_result.enum.js";
import type { Wager } from "../wagers/wager.entity.js";
import {
  WAGER_CREATED_EVENT,
  WAGER_CANCELLED_EVENT,
  WAGER_COMPLETED_EVENT,
} from "../wagers/wagers.constants.js";
import { UserRole } from "./enums/user_role.enum.js";
import { UserBadge } from "./enums/user_badge.enum.js";
import { UserTag } from "./enums/user_tag.enum.js";
import type { User } from "./user.entity.js";
import { COLLECTION_NAME, USER_CREATED_EVENT } from "./users.constants.js";

@Injectable()
export class UsersService implements OnModuleInit {
  static readonly WAGER_AMOUNT_BADGES = new Map<number, UserBadge>([
    [2e2, UserBadge.High_Roller],
    [2e3, UserBadge.Whale],
    [2e4, UserBadge.God],
  ]);

  constructor(
    @InjectCollection(COLLECTION_NAME)
    private readonly collection: Collection<User>,
    private readonly eventEmitter: EventEmitter2
  ) {}

  async onModuleInit() {
    await this.collection.createIndex({ name: 1 }, { unique: true });
  }

  async insert(name: string) {
    const id = nanoid();
    const now = new Date();
    const user: User = {
      _id: id,
      name,
      experience: 0,
      level: 0,
      role: UserRole.User,
      stats: {},
      badges: {},
      tags: {},
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await this.collection.insertOne(user);
    this.eventEmitter.emit(USER_CREATED_EVENT, user);
    return user;
  }

  findById(userId: string) {
    return this.collection.findOne({ _id: userId });
  }

  async findByIdOrThrow(userId: string) {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException("User not found.");
    }
    return user;
  }

  findByName(name: string) {
    return this.collection.findOne({ name });
  }

  async findByNameOrThrow(name: string) {
    const user = await this.findByName(name);
    if (!user) {
      throw new NotFoundException("User not found.");
    }
    return user;
  }

  async addTag(
    userId: string,
    tag: UserTag,
    issuerId: string,
    expiresAt: Date | null = null
  ) {
    const issuedAt = new Date();
    const entry = { issuerId, issuedAt, expiresAt };
    const { matchedCount, modifiedCount } = await this.collection.updateOne(
      { _id: userId },
      { $set: { [`tags.${tag}`]: entry } }
    );
    if (matchedCount === 0) {
      throw new NotFoundException("User not found.");
    }
    if (modifiedCount === 0) {
      throw new Error("Failed to add tag.");
    }
  }

  async removeTag(userId: string, tag: UserTag) {
    const { matchedCount, modifiedCount } = await this.collection.updateOne(
      { _id: userId },
      { $unset: { [`tags.${tag}`]: true } }
    );
    if (matchedCount === 0) {
      throw new NotFoundException("User not found.");
    }
    if (modifiedCount === 0) {
      throw new Error("Failed to remove tag.");
    }
  }

  async awardBadges(userId: string, badges: UserBadge[]) {
    const entries = badges.reduce(
      (acc, badge) => ({
        ...acc,
        [`badges.${badge}`]: new Date(),
      }),
      {}
    );
    await this.collection.updateOne({ _id: userId }, { $set: entries });
  }

  @OnEvent(WAGER_COMPLETED_EVENT)
  async onWagerCompleted(wager: Wager) {
    const user = await this.findById(wager.userId);
    if (!user) {
      return;
    }
    const badges: UserBadge[] = [];
    for (const [amount, badge] of UsersService.WAGER_AMOUNT_BADGES.entries()) {
      if (wager.amount >= amount && !user.badges[badge]) {
        badges.push(badge);
      }
    }
    if (badges.length > 0) {
      await this.awardBadges(user._id, badges);
    }
  }

  @OnEvent([WAGER_CREATED_EVENT, WAGER_CANCELLED_EVENT, WAGER_COMPLETED_EVENT])
  async onWagerUpdated(wager: Wager) {
    const filter: Filter<User> = { _id: wager.userId };
    const update: UpdateFilter<User> = {};
    update.$inc = {};
    switch (wager.status) {
      case WagerStatus.Active:
      case WagerStatus.Cancelled:
        update.$inc[`stats.wagered.${wager.currency}`] =
          wager.status === WagerStatus.Active ? wager.amount : -wager.amount;
        break;
      case WagerStatus.Completed:
        if (wager.result === WagerResult.Win) {
          update.$inc[`stats.won.${wager.game}`] = 1;
        } else {
          update.$inc[`stats.lost.${wager.game}`] = 1;
        }
        if (wager.profit) {
          update.$inc[`stats.profit.${wager.currency}`] =
            wager.profit[wager.currency];
        }
        break;
    }
    await this.collection.updateOne(filter, update);
  }
}
