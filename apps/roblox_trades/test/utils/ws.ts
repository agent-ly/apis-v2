import { WebSocket } from "ws";

export const openWs = (url: string) => {
  const ws = new WebSocket(url.replace("http", "ws"));
  return new Promise<WebSocket>((resolve, reject) => {
    ws.once("open", () => resolve(ws));
    ws.once("error", reject);
  });
};

export const nextEvent = (ws: WebSocket) =>
  new Promise<{ event: string; data: any }>((resolve, reject) => {
    ws.once("message", (data) => resolve(JSON.parse(data.toString())));
    ws.once("error", reject);
  });

export const strictNextEvent = async (ws: WebSocket, event: string) => {
  const next = await nextEvent(ws);
  if (next.event !== event) {
    throw new Error(`Expected event ${event}, got ${next.event}`);
  }
  return next;
};

export const sendEvent = (ws: WebSocket, event: string, data: any) => {
  if (ws.readyState !== WebSocket.OPEN) {
    throw new Error("WebSocket is not open");
  }
  ws.send(JSON.stringify({ event, data }));
};
