import { execSync } from "node:child_process";
import type { INestApplication } from "@nestjs/common";
import { FastifyAdapter } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { describe, it, beforeAll, afterAll } from "vitest";
import { request, spec, stash } from "pactum";
import { URI } from "otpauth";

import { AppModule } from "../src/app.module.js";

execSync('docker exec mongo mongosh --quiet --eval "db.dropDatabase()"');
execSync("docker exec redis redis-cli flushdb");

const getStoreValue = (key: string) =>
  (stash.getDataStore() as Record<string, any>)[key];

describe("Main", () => {
  let app: INestApplication;
  let url: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication(new FastifyAdapter());
    await app.listen(0);
    url = await app.getUrl();
    request.setBaseUrl(url);
  });

  it("Should register a user", () =>
    spec()
      .post("/auth/register")
      .withJson({
        username: "test",
      })
      .expectStatus(201)
      .stores("password", ""));

  it("Should login a user", () =>
    spec()
      .post("/auth/login")
      .withJson({
        username: "test",
        password: "$S{password}",
      })
      .expectStatus(200)
      .stores("accessToken", "accessToken")
      .stores("refreshToken", "refreshToken"));

  it("Should refresh a user", () =>
    spec()
      .post("/auth/refresh")
      .withBearerToken("$S{accessToken}")
      .withJson({
        token: "$S{refreshToken}",
      })
      .expectStatus(200)
      .stores("accessToken", "accessToken")
      .stores("refreshToken", "refreshToken"));

  it("Should setup authenticator", () =>
    spec()
      .post("/auth/security/authenticator/setup")
      .withBearerToken("$S{accessToken}")
      .withJson({
        password: "$S{password}",
      })
      .expectStatus(201)
      .stores("totpUri", ""));

  it("Should verify setup authenticator", () =>
    spec()
      .post("/auth/security/authenticator/verify")
      .withBearerToken("$S{accessToken}")
      .withJson({
        code: URI.parse(getStoreValue("totpUri")).generate(),
      })
      .expectStatus(200));

  it("Should remove authenticator", () =>
    spec()
      .post("/auth/security/authenticator/remove")
      .withBearerToken("$S{accessToken}")
      .withJson({
        code: URI.parse(getStoreValue("totpUri")).generate({
          timestamp: Date.now() + 30e3,
        }),
      })
      .expectStatus(200));

  afterAll(() => app.close());
});
