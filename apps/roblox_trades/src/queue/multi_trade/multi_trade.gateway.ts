import { OnEvent } from "@nestjs/event-emitter";
import { WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { WebSocket, type WebSocketServer as WsServer } from "ws";

import {
  type MultiTrade,
  MultiTradeChildStrategy,
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

  @OnEvent(MULTI_TRADE_PROCESSED_EVENT)
  onMultiTradeProcessed(multiTrade: MultiTrade): void {
    const result = this.toMultiTradeResult(multiTrade);
    this.broadcastEvent(MULTI_TRADE_PROCESSED_EVENT, result);
  }

  toMultiTradeResult(multiTrade: MultiTrade): MultiTradeResult {
    const { senderIds, receiverIds, userAssetIds, participantDetails } =
      multiTrade.children.reduce(
        (acc, child) => {
          acc.senderIds.add(child.offerFromUserId);
          acc.receiverIds.add(child.offerToUserId);
          child.offerFromUserAssetIds.forEach((userAssetId) =>
            acc.userAssetIds.add(userAssetId)
          );
          const [senderId, receiverId] =
            child.strategy === MultiTradeChildStrategy.Sender_To_Receiver
              ? [child.offerFromUserId, child.offerToUserId]
              : [child.offerToUserId, child.offerFromUserId];
          const sender =
            acc.participantDetails.get(senderId) ??
            this.createMultiTradeResultParticipant();
          const receiver =
            acc.participantDetails.get(receiverId) ??
            this.createMultiTradeResultParticipant();
          if (child.tradeId) {
            sender.tradesSent++;
            receiver.tradesReceived++;
            if (child.tradeStatus === "Completed") {
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
