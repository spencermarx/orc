export type WsMessage =
  | { type: "state:subscribe"; channel: string }
  | { type: "pty:output"; sessionId: string; data: string };

export type WsResponse =
  | { type: "state:snapshot"; channel: string; data: unknown }
  | { type: "pty:data"; sessionId: string; data: string }
  | { type: "error"; message: string };

export function handleWsMessage(raw: string): WsResponse {
  let msg: WsMessage;
  try {
    msg = JSON.parse(raw) as WsMessage;
  } catch {
    return { type: "error", message: "Invalid JSON" };
  }

  switch (msg.type) {
    case "state:subscribe":
      return {
        type: "state:snapshot",
        channel: msg.channel,
        data: { subscribed: true, channel: msg.channel },
      };
    case "pty:output":
      return {
        type: "pty:data",
        sessionId: msg.sessionId,
        data: msg.data,
      };
    default:
      return { type: "error", message: `Unknown message type` };
  }
}
