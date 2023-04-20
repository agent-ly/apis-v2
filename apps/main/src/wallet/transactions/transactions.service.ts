import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectCollection } from "nestjs-super-mongodb";
import type { Collection } from "mongodb";
import { nanoid } from "nanoid";

import { Transaction } from "./transaction.entity.js";
import { COLLECTION_NAME } from "./transactions.constants.js";

@Injectable()
export class TransactionsService {
  constructor(
    @InjectCollection(COLLECTION_NAME)
    private readonly collection: Collection<Transaction>
  ) {}

  async create(payload: CreateTransactionPayload) {
    const id = nanoid();
    const now = new Date();
    const transaction: Transaction = {
      _id: id,
      userId: payload.userId,
      type: payload.type,
      event: payload.event,
      amount: payload.amount,
      previousBalance: payload.previousBalance,
      newBalance: payload.newBalance,
      details: payload.details,
      createdAt: now,
      updatedAt: now,
    };
    await this.collection.insertOne(transaction);
    return id;
  }

  async findAllById(userId: string) {
    const cursor = this.collection.find({ userId });
    return cursor.toArray();
  }

  async findById(userId: string, transactionId: string) {
    const transaction = await this.collection.findOne({
      _id: transactionId,
      userId,
    });
    if (!transaction) {
      throw new NotFoundException("Transaction not found.");
    }
    return transaction;
  }
}

type CreateTransactionPayload = Pick<
  Transaction,
  | "userId"
  | "type"
  | "event"
  | "amount"
  | "previousBalance"
  | "newBalance"
  | "details"
>;
