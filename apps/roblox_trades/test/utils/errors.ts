import { RobloxErrorHost } from "roblox-proxy-nestjs";

const createStringErrorResponse = ({
  body,
  status,
  statusText,
  headers,
}: {
  body: string;
  status: number;
  statusText: string;
  headers?: Record<string, string>;
}) =>
  new Response(body, {
    status,
    statusText,
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
  });

const createChallengeHeaders = ({
  id,
  type,
  metadata,
}: {
  id: string;
  type: string;
  metadata: Record<string, any>;
}) => ({
  "access-control-expose-headers":
    "rblx-challenge-id,rblx-challenge-type,rblx-challenge-metadata",
  "rblx-challenge-id": id,
  "rblx-challenge-type": type,
  "rblx-challenge-metadata": Buffer.from(JSON.stringify(metadata)).toString(
    "base64"
  ),
});

export const createTwoStepVerificationErrorResponse = () =>
  createStringErrorResponse({
    body: "Challenge is required to authorize the request",
    status: 403,
    statusText: "Forbidden",
    headers: createChallengeHeaders({
      id: "test",
      type: "twostepverification",
      metadata: { challengeId: "test", actionType: "Generic" },
    }),
  });

export const createRobloxErrorHost = (response: Response) =>
  new RobloxErrorHost(response);
