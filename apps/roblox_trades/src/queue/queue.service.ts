import { BadRequestException, Injectable } from "@nestjs/common";

import { CryptService } from "../crypt/crypt.service.js";
import {
  MultiTradeJob,
  MultiTradeJobStrategy,
} from "./multi_trade/multi_trade.entity.js";
import type { AddMultiTradePayload } from "./multi_trade/multi_trade.interfaces.js";
import { MultiTradeService } from "./multi_trade/multi_trade.service.js";
import { AddOneToOneMutliTradePayloadDto } from "./queue.dtos.js";

@Injectable()
export class QueueService {
  constructor(
    private readonly cryptService: CryptService,
    private readonly multiTradeService: MultiTradeService
  ) {}

  async addMultiTrade({
    jobs,
    credentials,
    userAssetIds,
    recyclableUserAssetIds,
  }: AddMultiTradePayload): Promise<string> {
    const multiTrade = await this.multiTradeService.add({
      jobs,
      credentials,
      userAssetIds,
      recyclableUserAssetIds,
    });
    return multiTrade._id;
  }

  addOneToOneMultiTrade(
    payload: AddOneToOneMutliTradePayloadDto
  ): Promise<string> {
    const multiTradePayload = this.fromOneToOnePayload(payload);
    return this.addMultiTrade(multiTradePayload);
  }

  private fromOneToOnePayload(
    payload: AddOneToOneMutliTradePayloadDto
  ): AddMultiTradePayload {
    this.validateOneToOnePayload(payload);
    const [senderCredentials, receiverCredentials] = [
      {
        roblosecurity: this.cryptService.encrypt(payload.sender.roblosecurity),
        totpSecret: payload.sender.totpSecret
          ? this.cryptService.encrypt(payload.sender.totpSecret)
          : undefined,
      },
      {
        roblosecurity: this.cryptService.encrypt(
          payload.receiver.roblosecurity
        ),
        totpSecret: payload.receiver.totpSecret
          ? this.cryptService.encrypt(payload.receiver.totpSecret)
          : undefined,
      },
    ];
    const numTrades = Math.ceil(
      payload.sender.userAssetIds.length / payload.maxItemsPerTrade
    );
    const jobs: MultiTradeJob[] = [];
    const mutableSenderUserAssetIds = [...payload.sender.userAssetIds];
    for (let i = 0; i < numTrades; i++) {
      const userAssetIds = mutableSenderUserAssetIds.splice(
        0,
        Math.min(payload.maxItemsPerTrade, mutableSenderUserAssetIds.length)
      );
      jobs.push(
        this.createMultiTradeJobEntry(
          payload.strategy,
          payload.sender.id,
          payload.receiver.id,
          userAssetIds
        )
      );
    }
    return {
      jobs,
      credentials: [
        [payload.sender.id, senderCredentials],
        [payload.receiver.id, receiverCredentials],
      ],
      userAssetIds: [[payload.sender.id, payload.sender.userAssetIds]],
      recyclableUserAssetIds: [
        [payload.sender.id, payload.sender.recyclableUserAssetIds],
        [payload.receiver.id, payload.receiver.recyclableUserAssetIds],
      ],
    };
  }

  private validateOneToOnePayload(
    payload: AddOneToOneMutliTradePayloadDto
  ): void {
    if (payload.sender.id === payload.receiver.id) {
      throw new BadRequestException("Sender and receiver cannot be the same.");
    }
    const [offerer, offeree] =
      payload.strategy === MultiTradeJobStrategy.Sender_To_Receiver
        ? [payload.sender, payload.receiver]
        : [payload.receiver, payload.sender];
    if (offerer.userAssetIds.length === 0) {
      throw new BadRequestException(
        `User ${offerer.id} user asset IDs are empty.`
      );
    }
    if (offeree.recyclableUserAssetIds.length === 0) {
      throw new BadRequestException(
        `User ${offeree.id} recyclable user asset IDs are empty.`
      );
    }
  }

  private createMultiTradeJobEntry(
    strategy: MultiTradeJobStrategy,
    offerFromUserId: number,
    offerToUserId: number,
    userAssetIds: number[]
  ): MultiTradeJob {
    return {
      strategy: strategy,
      offerFromUserId: offerFromUserId,
      offerToUserId: offerToUserId,
      userAssetIds: userAssetIds,
      refId: null,
      refStatus: null,
      tradeId: null,
      tradeStatus: null,
      startedAt: null,
      processedAt: null,
    };
  }
}
