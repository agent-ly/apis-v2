import { Controller, Get, UseFilters, Param, Query } from "@nestjs/common";
import { createPageCursor } from "roblox-util/pagination";
import { RobloxExceptionFilter } from "roblox-proxy-nestjs";
import { InventoryApi } from "roblox-proxy-nestjs/apis/inventory.api";
import { UsersApi } from "roblox-proxy-nestjs/apis/users.api";

@Controller("user")
@UseFilters(RobloxExceptionFilter)
export class UserController {
  constructor(
    private readonly inventoryApi: InventoryApi,
    private readonly usersApi: UsersApi
  ) {}

  @Get(":userId")
  getUser(@Param("userId") userId: number) {
    return this.usersApi.getUser(userId);
  }

  @Get(":userId/inventory/collectibles")
  getUserCollectibles(
    @Param("userId") userId: number,
    @Query("cursor") cursor?: string
  ) {
    return this.inventoryApi.getUserOwnedCollectibleAssets(userId, cursor);
  }

  @Get(":userId/inventory/all-collectibles")
  async getUserAllCollectibles(@Param("userId") userId: number) {
    const cursor = createPageCursor((cursor?: string) =>
      this.inventoryApi.getUserOwnedCollectibleAssets(userId, cursor)
    );
    const collectibles = await cursor.toArray();
    return collectibles;
  }
}
