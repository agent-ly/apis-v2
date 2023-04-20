import { OnEvent } from "@nestjs/event-emitter";
import { WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { WebSocket, type WebSocketServer as WsServer } from "ws";

import {
  type MultiTrade,
  MultiTradeJobStrategy,
  MultiTradeStatus,
} from "./multi_trade.entity.js";
import type {
  MultiTradeResult,
  MultiTradeResultParticipant,
} from "./multi_trade.interfaces.js";
import { MULTI_TRADE_PROCESSED_EVENT } from "./multi_trade.constants.js";

@WebSocketGateway()
export class MultiTradeGateway {
  @WebSocketServer()
  server: WsServer;

  emitMultiTradeProcessed(multiTrade: MultiTrade): void {
    const result = this.toMultiTradeResult(multiTrade);
    this.broadcastEvent(MULTI_TRADE_PROCESSED_EVENT, result);
  }

  @OnEvent(MULTI_TRADE_PROCESSED_EVENT)
  handleMultiTradeProcessed(multiTrade: MultiTrade): void {
    this.emitMultiTradeProcessed(multiTrade);
  }

  toMultiTradeResult(multiTrade: MultiTrade): MultiTradeResult {
    const { senderIds, receiverIds, userAssetIds, participantDetails } =
      multiTrade.jobs.reduce(
        (acc, multiTradeJob) => {
          const [senderId, receiverId] =
            multiTradeJob.strategy === MultiTradeJobStrategy.Sender_To_Receiver
              ? [multiTradeJob.offerFromUserId, multiTradeJob.offerToUserId]
              : [multiTradeJob.offerToUserId, multiTradeJob.offerFromUserId];
          acc.senderIds.add(senderId);
          acc.receiverIds.add(receiverId);
          multiTradeJob.userAssetIds.forEach((userAssetId) =>
            acc.userAssetIds.add(userAssetId)
          );
          const sender =
            acc.participantDetails.get(senderId) ??
            this.createMultiTradeResultParticipant();
          const receiver =
            acc.participantDetails.get(receiverId) ??
            this.createMultiTradeResultParticipant();
          if (multiTradeJob.tradeId) {
            sender.tradesSent++;
            receiver.tradesReceived++;
            if (multiTradeJob.tradeStatus === "Completed") {
              sender.tradesCompleted++;
              receiver.tradesCompleted++;
            } else {
              sender.tradesFailed++;
              receiver.tradesFailed++;
            }
          }
          acc.participantDetails.set(senderId, sender);
          acc.participantDetails.set(receiverId, receiver);
          return acc;
        },
        {
          senderIds: new Set<number>(),
          receiverIds: new Set<number>(),
          userAssetIds: new Set<number>(),
          participantDetails: new Map<number, MultiTradeResultParticipant>(),
        }
      );
    return {
      id: multiTrade._id,
      status: multiTrade.status,
      ok: multiTrade.status === MultiTradeStatus.Finished,
      senderIds: [...senderIds],
      receiverIds: [...receiverIds],
      userAssetIds: [...userAssetIds],
      recyclableUserAssetIds: [
        ...multiTrade.recyclableUserAssetIds.values(),
      ].flat(),
      participantDetails: [...participantDetails],
      ownershipDetails: {
        userAssetIds: [...multiTrade.userAssetIds],
        recyclableUserAssetIds: [...multiTrade.recyclableUserAssetIds],
      },
      error: multiTrade.error,
    };
  }

  private createMultiTradeResultParticipant(): MultiTradeResultParticipant {
    return {
      tradesSent: 0,
      tradesReceived: 0,
      tradesCompleted: 0,
      tradesFailed: 0,
    };
  }

  private broadcastEvent(event: string, data: unknown): void {
    this.broadcastMessage(JSON.stringify({ event, data }));
  }

  private broadcastMessage(data: string): void {
    this.server.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }
}
