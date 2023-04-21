import { createInterface } from "node:readline/promises";

import { openWs, sendEvent } from "./utils/ws.js";
import {
  SINGLE_TRADE_AUTHORIZE_EVENT,
  SINGLE_TRADE_CHALLENGE_EVENT,
} from "../src/queue/single_trade/single_trade.constants.js";
import { MULTI_TRADE_PROCESSED_EVENT } from "../src/queue/multi_trade/multi_trade.constants.js";

const baseURL = "http://localhost:8072";

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

const ws = await openWs(baseURL.replace("http", "ws"));

const ids = [73721574, 3577567];
const cookies = [
  "_|a2c5e9f0-us-ca-losangeles|_7F6768FFFBC1AEB5737CF9D668EA0B5271CEE4F9F28CC0BFF37181D0E942D26CF1E4BCBC04E5887950A54F8373AD981B161A72E661236465D5470D495EC7E4A187D55C5889C256C71EAB7EC701495A1977747D305BBDB6CBAEB9049E385CEDFE7480B9F769962ADF6BD97780434198B750B4A39A1D01A721220BB6728F4F6B0B0BD74242F098BA4542CFC656633D29A10A698A616DCE95EA161DA1C1B87D851926B0141AEECF76E3D12892B8E1D5BE7730E6B200B3549E09BF891A3A5A72C4092EC04C6249D1FBF8B58FE02F33457698508C7134E439ADC55F8A68D7FBB44F0ED62CD68EF982DA92C37527D2F6E9BF0CA8B7667648011232DD21FA33DA49AC0D447F5FF3A776715DB2080C283A0BA0B1E79A23DE1798D4643DE63A913568EF5656AF7C1C265CC46FF794434AECAB9922645F35270DA46F24DF0ED777E60024F3B8E2CD52191FABD905E34C5D793FC7BB8B23608FDACEF97AAA5BE9E2F180773C25780B6F",
  "_|8f4d1b7e-us-ca-losangeles|_167A269BCD01CB5D27CBF7E34654877B9F86B56FAA331E95D1FAC78A70F6F095CC6D7E6BEE732D1EDB2C3A9D8CC00F1FD1D69DB6ADDB774F9247017C34C885CB85154BF509E15D1C5061D2630D096B189EBE0B0FC40EDD9F4E6A473BD09E7506908939D60DCF997F2D6EB2504688B57189EC80251DBB68E5548DAF61E8EDAAB11D7BD74F8232FCE65DBFEF646A000FDC668C6D8B3AF0A6619C164C5B3A4CCCEFAA0A79E15E2A147276FAF260A59056A9F7BAD7276DDA681E000EB27C39BCBE126B5159D9E0C5EB856DF0CCFBE5389AB31CC71D7587463FD7CD48BEA7F681D217987C6C5AB0B60AED548DC43184332A7506461DBFFD67DF6D545E465D793CC707B78F82D4AD1C3EC2B99F469EA8A35608D5333C0C843753D8E9EA25A647F48171E0688F4166A76CD0B9FBB0AC879329BF5C5E6FFB5E4994799F34507A1EFEC8D486425781",
];

const response = await fetch(`${baseURL}/queue/add`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    maxItemsPerTrade: 3,
    strategy: "receiver_to_sender",
    sender: {
      id: ids[1],
      roblosecurity: cookies[1],
      userAssetIds: [22153253101],
      recyclableUserAssetIds: [60114382757],
    },
    receiver: {
      id: ids[0],
      roblosecurity: cookies[0],
      userAssetIds: [],
      recyclableUserAssetIds: [60129227257],
    },
  }),
});

if (!response.ok) {
  process.exit(1);
}

ws.on("message", async (message) => {
  const data = JSON.parse(message.toString());
  if (data.event === SINGLE_TRADE_CHALLENGE_EVENT) {
    const code = await rl.question(`Enter code for User ${data.data.userId}: `);
    sendEvent(ws, SINGLE_TRADE_AUTHORIZE_EVENT, {
      singleTradeId: data.data.singleTradeId,
      userId: data.data.userId,
      code,
    });
  } else if (data.event === MULTI_TRADE_PROCESSED_EVENT) {
    console.dir(data.data, { depth: null });
    ws.close();
    process.exit(0);
  }
});
