import { BadRequestException, Injectable } from "@nestjs/common";

import {
  MultiTradeChild,
  MultiTradeChildStrategy,
  MultiTradeUser,
} from "./multi_trade/multi_trade.entity.js";
import type { AddMultiTradePayload } from "./multi_trade/multi_trade.interfaces.js";
import { MultiTradeService } from "./multi_trade/multi_trade.service.js";
import {
  AddOneToOneMutliTradePayloadDto,
  AddManyToOneMutliTradePayloadDto,
} from "./queue.dtos.js";
import { MultiTradeUserDto } from "./queue.dtos.js";

@Injectable()
export class QueueService {
  constructor(private readonly multiTradeService: MultiTradeService) {}

  async addMultiTrade({
    children: jobs,
    users: credentials,
    userAssetIds,
    recyclableUserAssetIds,
  }: AddMultiTradePayload): Promise<string> {
    const multiTrade = this.multiTradeService.prepare({
      children: jobs,
      users: credentials,
      userAssetIds,
      recyclableUserAssetIds,
    });
    await this.multiTradeService.add(multiTrade);
    return multiTrade._id;
  }

  addOneToOneMultiTrade(
    payload: AddOneToOneMutliTradePayloadDto
  ): Promise<string> {
    const multiTradePayload = this.fromOneToOnePayload(payload);
    return this.addMultiTrade(multiTradePayload);
  }

  addManyToOneMultiTrade(
    payload: AddManyToOneMutliTradePayloadDto
  ): Promise<string> {
    const multiTradePayload = this.fromManyToOnePayload(payload);
    return this.addMultiTrade(multiTradePayload);
  }

  private fromManyToOnePayload(
    payload: AddManyToOneMutliTradePayloadDto
  ): AddMultiTradePayload {
    const users: [number, MultiTradeUser][] = [];
    const userAssetIds: [number, number[]][] = [];
    const recyclableUserAssetIds: [number, number[]][] = [];
    const children = payload.senders.flatMap((sender) => {
      users.push([sender.id, this.createMultiTradeUser(sender)]);
      userAssetIds.push([sender.id, sender.userAssetIds]);
      recyclableUserAssetIds.push([sender.id, sender.recyclableUserAssetIds]);
      return this.createMultiTradeChildren(
        payload.maxItemsPerTrade,
        payload.strategy,
        sender,
        payload.receiver
      );
    });
    users.push([
      payload.receiver.id,
      this.createMultiTradeUser(payload.receiver),
    ]);
    recyclableUserAssetIds.push([
      payload.receiver.id,
      payload.receiver.recyclableUserAssetIds,
    ]);
    return {
      users,
      userAssetIds,
      recyclableUserAssetIds,
      children,
    };
  }

  private fromOneToOnePayload(
    payload: AddOneToOneMutliTradePayloadDto
  ): AddMultiTradePayload {
    return this.fromManyToOnePayload({
      maxItemsPerTrade: payload.maxItemsPerTrade,
      strategy: payload.strategy,
      senders: [payload.sender],
      receiver: payload.receiver,
    });
  }

  private createMultiTradeChildren(
    maxItemsPerTrade: number,
    strategy: MultiTradeChildStrategy,
    sender: MultiTradeUserDto,
    receiver: MultiTradeUserDto
  ): MultiTradeChild[] {
    this.validateMultiTradeChild(sender, receiver);
    const numTrades = Math.ceil(sender.userAssetIds.length / maxItemsPerTrade);
    const clonedUserAssetIds = [...sender.userAssetIds];
    const children: MultiTradeChild[] = [];
    for (let i = 0; i < numTrades; i++) {
      const userAssetIds = clonedUserAssetIds.splice(
        0,
        Math.min(maxItemsPerTrade, clonedUserAssetIds.length)
      );
      children.push(
        this.createMultiTradeChild(
          strategy,
          sender.id,
          receiver.id,
          userAssetIds
        )
      );
    }
    return children;
  }

  private validateMultiTradeChild(
    sender: MultiTradeUserDto,
    receiver: MultiTradeUserDto
  ): void {
    if (sender.id === receiver.id) {
      throw new BadRequestException("Sender and receiver cannot be the same.");
    }
    if (
      !sender.userAssetIds ||
      !sender.recyclableUserAssetIds ||
      !receiver.recyclableUserAssetIds
    ) {
      throw new BadRequestException("Invalid user asset IDs.");
    }
    if (sender.userAssetIds.length === 0) {
      throw new BadRequestException(
        `Sender ${sender.id} user asset IDs are empty.`
      );
    }
    if (receiver.recyclableUserAssetIds.length === 0) {
      throw new BadRequestException(
        `Receiver ${receiver.id} recyclable user asset IDs are empty.`
      );
    }
  }

  private createMultiTradeChild(
    strategy: MultiTradeChildStrategy,
    offerFromUserId: number,
    offerToUserId: number,
    userAssetIds: number[]
  ): MultiTradeChild {
    return {
      strategy: strategy,
      offerFromUserId: offerFromUserId,
      offerToUserId: offerToUserId,
      offerFromUserAssetIds: userAssetIds,
      offerToUserAssetIds: [],
      id: null,
      status: null,
      tradeId: null,
      tradeStatus: null,
      startedAt: null,
      processedAt: null,
    };
  }

  private createMultiTradeUser(user: MultiTradeUserDto): MultiTradeUser {
    return {
      roblosecurity: user.roblosecurity,
      totpSecret: user.totpSecret,
    };
  }
}
