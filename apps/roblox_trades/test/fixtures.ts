import {
  createRobloxErrorHost,
  createTwoStepVerificationErrorResponse,
} from "./utils/errors.js";

export const fixtures = [
  {
    input: {
      maxItemsPerTrade: 3,
      strategy: "sender_to_receiver",
      sender: {
        id: 1,
        roblosecurity: "test1",
        userAssetIds: [1, 2, 3],
        recyclableUserAssetIds: [4],
      },
      receiver: {
        id: 2,
        roblosecurity: "test2",
        userAssetIds: [],
        recyclableUserAssetIds: [5],
      },
    },
    output: {
      status: "finished",
      ok: true,
      senderIds: [1],
      receiverIds: [2],
      userAssetIds: [1, 2, 3],
      recyclableUserAssetIds: [5, 4],
      participantDetails: [
        [
          1,
          {
            tradesSent: 1,
            tradesReceived: 0,
            tradesCompleted: 1,
            tradesFailed: 0,
          },
        ],
        [
          2,
          {
            tradesSent: 0,
            tradesReceived: 1,
            tradesCompleted: 1,
            tradesFailed: 0,
          },
        ],
      ],
      ownershipDetails: {
        userAssetIds: [
          [1, []],
          [2, [1, 2, 3]],
        ],
        recyclableUserAssetIds: [
          [1, [5]],
          [2, [4]],
        ],
      },
      errors: [],
    },
  },
  {
    input: {
      maxItemsPerTrade: 3,
      strategy: "receiver_to_sender",
      sender: {
        id: 1,
        roblosecurity: "test1",
        userAssetIds: [1, 2, 3],
        recyclableUserAssetIds: [4],
      },
      receiver: {
        id: 2,
        roblosecurity: "test2",
        userAssetIds: [],
        recyclableUserAssetIds: [5],
      },
    },
    output: {
      status: "finished",
      ok: true,
      senderIds: [1],
      receiverIds: [2],
      userAssetIds: [1, 2, 3],
      recyclableUserAssetIds: [5, 4],
      participantDetails: [
        [
          2,
          {
            tradesSent: 1,
            tradesReceived: 0,
            tradesCompleted: 1,
            tradesFailed: 0,
          },
        ],
        [
          1,
          {
            tradesSent: 0,
            tradesReceived: 1,
            tradesCompleted: 1,
            tradesFailed: 0,
          },
        ],
      ],
      ownershipDetails: {
        userAssetIds: [
          [1, []],
          [2, [1, 2, 3]],
        ],
        recyclableUserAssetIds: [
          [1, [5]],
          [2, [4]],
        ],
      },
      errors: [],
    },
  },
  {
    input: {
      maxItemsPerTrade: 3,
      strategy: "sender_to_receiver",
      senders: [
        {
          id: 1,
          roblosecurity: "test1",
          userAssetIds: [1, 2, 3],
          recyclableUserAssetIds: [4],
        },
        {
          id: 3,
          roblosecurity: "test3",
          userAssetIds: [6, 7, 8],
          recyclableUserAssetIds: [9],
        },
      ],
      receiver: {
        id: 2,
        roblosecurity: "test2",
        userAssetIds: [],
        recyclableUserAssetIds: [5],
      },
    },
    output: {
      status: "finished",
      ok: true,
      senderIds: [1, 3],
      receiverIds: [2],
      userAssetIds: [1, 2, 3, 6, 7, 8],
      recyclableUserAssetIds: [5, 4, 9],
      participantDetails: [
        [
          1,
          {
            tradesSent: 1,
            tradesReceived: 0,
            tradesCompleted: 1,
            tradesFailed: 0,
          },
        ],
        [
          2,
          {
            tradesSent: 0,
            tradesReceived: 2,
            tradesCompleted: 2,
            tradesFailed: 0,
          },
        ],
        [
          3,
          {
            tradesSent: 1,
            tradesReceived: 0,
            tradesCompleted: 1,
            tradesFailed: 0,
          },
        ],
      ],
      ownershipDetails: {
        userAssetIds: [
          [1, []],
          [3, []],
          [2, [1, 2, 3, 6, 7, 8]],
        ],
        recyclableUserAssetIds: [
          [1, [5]],
          [3, [4]],
          [2, [9]],
        ],
      },
      errors: [],
    },
  },
  {
    input: {
      maxItemsPerTrade: 3,
      strategy: "receiver_to_sender",
      senders: [
        {
          id: 1,
          roblosecurity: "test1",
          userAssetIds: [1, 2, 3],
          recyclableUserAssetIds: [4],
        },
        {
          id: 3,
          roblosecurity: "test3",
          userAssetIds: [6, 7, 8],
          recyclableUserAssetIds: [9],
        },
      ],
      receiver: {
        id: 2,
        roblosecurity: "test2",
        userAssetIds: [],
        recyclableUserAssetIds: [5],
      },
    },
    output: {
      status: "finished",
      ok: true,
      senderIds: [1, 3],
      receiverIds: [2],
      userAssetIds: [1, 2, 3, 6, 7, 8],
      recyclableUserAssetIds: [5, 4, 9],
      participantDetails: [
        [
          2,
          {
            tradesSent: 2,
            tradesReceived: 0,
            tradesCompleted: 2,
            tradesFailed: 0,
          },
        ],
        [
          1,
          {
            tradesSent: 0,
            tradesReceived: 1,
            tradesCompleted: 1,
            tradesFailed: 0,
          },
        ],
        [
          3,
          {
            tradesSent: 0,
            tradesReceived: 1,
            tradesCompleted: 1,
            tradesFailed: 0,
          },
        ],
      ],
      ownershipDetails: {
        userAssetIds: [
          [1, []],
          [3, []],
          [2, [1, 2, 3, 6, 7, 8]],
        ],
        recyclableUserAssetIds: [
          [1, [5]],
          [3, [4]],
          [2, [9]],
        ],
      },
      errors: [],
    },
  },
];

export const errorFixtures = [
  {
    sendTrade: createRobloxErrorHost(createTwoStepVerificationErrorResponse()),
    input: fixtures[0].input,
    output: fixtures[0].output,
  },
];
