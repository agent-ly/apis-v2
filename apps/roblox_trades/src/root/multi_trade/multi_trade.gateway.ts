import { OnEvent } from "@nestjs/event-emitter";
import { WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { WebSocket, type WebSocketServer as WsServer } from "ws";

import {
  type MultiTrade,
  MultiTradeChildStrategy,
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

  private toMultiTradeResult(multiTrade: MultiTrade): MultiTradeResult {
    const { senderIds, receiverIds, participantDetails, errors } =
      multiTrade.children.reduce(
        (acc, child) => {
          acc.senderIds.add(child.fromUserId);
          acc.receiverIds.add(child.toUserId);
          const [senderId, receiverId] =
            child.strategy === MultiTradeChildStrategy.Sender_To_Receiver
              ? [child.fromUserId, child.toUserId]
              : [child.toUserId, child.fromUserId];
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
          if (child.error) {
            acc.errors.push(child.error);
          }
          return acc;
        },
        {
          senderIds: new Set<number>(),
          receiverIds: new Set<number>(),
          userAssetIds: new Set<number>(),
          participantDetails: new Map<number, MultiTradeResultParticipant>(),
          errors: [] as NonNullable<MultiTrade["children"][number]["error"]>[],
        }
      );
    return {
      id: multiTrade._id,
      status: multiTrade.status,
      ok: errors.length === 0,
      senderIds: [...senderIds],
      receiverIds: [...receiverIds],
      userAssetIds: [...multiTrade.userAssetIds.values()].flat(),
      recyclableUserAssetIds: [
        ...multiTrade.recyclableUserAssetIds.values(),
      ].flat(),
      participantDetails: [...participantDetails],
      ownershipDetails: {
        userAssetIds: [...multiTrade.userAssetIds],
        recyclableUserAssetIds: [...multiTrade.recyclableUserAssetIds],
      },
      errors,
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
