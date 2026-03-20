import { Hono } from "hono";

// In-memory subscription registry
const subscriptions = new Map<string, Set<WebSocket>>();

export function broadcastToTag(tag: string, data: unknown) {
  const subs = subscriptions.get(tag);
  if (!subs) return;

  const message = JSON.stringify(data);
  for (const ws of subs) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  }
}

const ws = new Hono();

// WebSocket upgrade handled at the server level in index.ts
// This module exports the subscription management utilities

export function handleWebSocketConnection(socket: WebSocket) {
  const tags = new Set<string>();

  socket.addEventListener("message", (event) => {
    try {
      const msg = JSON.parse(String(event.data));

      if (msg.type === "subscribe" && msg.tag) {
        tags.add(msg.tag);
        if (!subscriptions.has(msg.tag)) {
          subscriptions.set(msg.tag, new Set());
        }
        subscriptions.get(msg.tag)!.add(socket);
        socket.send(JSON.stringify({ type: "subscribed", tag: msg.tag }));
      }

      if (msg.type === "unsubscribe" && msg.tag) {
        tags.delete(msg.tag);
        subscriptions.get(msg.tag)?.delete(socket);
        socket.send(JSON.stringify({ type: "unsubscribed", tag: msg.tag }));
      }

      if (msg.type === "ping") {
        socket.send(JSON.stringify({ type: "pong" }));
      }
    } catch {
      // Ignore malformed messages
    }
  });

  socket.addEventListener("close", () => {
    for (const tag of tags) {
      subscriptions.get(tag)?.delete(socket);
      if (subscriptions.get(tag)?.size === 0) {
        subscriptions.delete(tag);
      }
    }
  });
}

export { ws };
