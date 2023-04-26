import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";

export abstract class WorkerHost implements OnModuleInit, OnModuleDestroy {
  protected alive = false;

  onModuleInit(): void {
    this.alive = true;
    this.process();
  }

  onModuleDestroy(): void {
    this.alive = false;
  }

  abstract process(): void | Promise<void>;
}
