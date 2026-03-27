export type WsClientOptions = {
  url: string;
  token?: string;
  onMessage?: (data: unknown) => void;
  onClose?: () => void;
  onError?: (error: Error) => void;
};

export type WsClient = {
  send: (data: unknown) => void;
  close: () => void;
};

/**
 * Creates a WebSocket client helper.
 * Works in both browser (native WebSocket) and Node (ws).
 */
export function createWsClient(options: WsClientOptions): WsClient {
  const { url, token, onMessage, onClose, onError } = options;

  const wsUrl = token ? `${url}?token=${encodeURIComponent(token)}` : url;
  const ws = new WebSocket(wsUrl);

  ws.addEventListener("message", (event) => {
    try {
      const parsed: unknown = JSON.parse(String(event.data));
      onMessage?.(parsed);
    } catch {
      onMessage?.(event.data);
    }
  });

  ws.addEventListener("close", () => onClose?.());
  ws.addEventListener("error", () => onError?.(new Error("WebSocket error")));

  return {
    send(data: unknown) {
      ws.send(JSON.stringify(data));
    },
    close() {
      ws.close();
    },
  };
}
