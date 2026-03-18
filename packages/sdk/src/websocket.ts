// ─── WebSocket client for real-time note notifications ───────────────────────

export interface WsNoteEvent {
  tag: string;
  type: 'note_received' | 'nullifier_spent' | 'deposit';
  payload: Record<string, unknown>;
}

type EventCallback = (event: WsNoteEvent) => void;

const BASE_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 30_000;
const BACKOFF_MULTIPLIER = 2;

/**
 * Lightweight WebSocket client with:
 * - Tag-based subscriptions (one WebSocket, many subscribers)
 * - Automatic exponential-backoff reconnection
 * - Auth via `Authorization: Bearer` query param on handshake
 */
export class ShroudWebSocket {
  private ws: WebSocket | null = null;
  private readonly subscriptions = new Map<string, Set<EventCallback>>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private backoffMs = BASE_BACKOFF_MS;
  private destroyed = false;

  constructor(
    private readonly url: string,
    private readonly apiKey?: string,
  ) {}

  // ─── Public API ─────────────────────────────────────────────────────────────

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.destroyed) return;
    this.openConnection();
  }

  /**
   * Subscribe to events for a given tag (e.g. Poseidon-hash of a wallet public key).
   * Returns an unsubscribe function — call it to cancel the subscription.
   */
  subscribe(tag: string, callback: EventCallback): () => void {
    let tagSet = this.subscriptions.get(tag);
    if (!tagSet) {
      tagSet = new Set();
      this.subscriptions.set(tag, tagSet);
    }
    tagSet.add(callback);

    // Ensure we are connected
    this.connect();

    // Send subscription message if socket is already open
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({ type: 'subscribe', tag });
    }

    return () => {
      tagSet?.delete(callback);
      if (tagSet?.size === 0) {
        this.subscriptions.delete(tag);
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.send({ type: 'unsubscribe', tag });
        }
      }
    };
  }

  disconnect(): void {
    this.destroyed = true;
    this.clearReconnectTimer();
    this.ws?.close(1000, 'client disconnect');
    this.ws = null;
  }

  // ─── Internal ───────────────────────────────────────────────────────────────

  private buildUrl(): string {
    if (!this.apiKey) return this.url;
    const sep = this.url.includes('?') ? '&' : '?';
    return `${this.url}${sep}token=${encodeURIComponent(this.apiKey)}`;
  }

  private openConnection(): void {
    try {
      this.ws = new WebSocket(this.buildUrl());
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.backoffMs = BASE_BACKOFF_MS;
      // Re-subscribe all active tags after (re)connect
      for (const tag of this.subscriptions.keys()) {
        this.send({ type: 'subscribe', tag });
      }
    };

    this.ws.onmessage = (event: MessageEvent<string>) => {
      this.handleMessage(event.data);
    };

    this.ws.onerror = () => {
      // onerror is always followed by onclose; do nothing here
    };

    this.ws.onclose = (event: CloseEvent) => {
      this.ws = null;
      if (!this.destroyed && event.code !== 1000) {
        this.scheduleReconnect();
      }
    };
  }

  private handleMessage(raw: string): void {
    let msg: unknown;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (!isWsNoteEvent(msg)) return;

    const callbacks = this.subscriptions.get(msg.tag);
    if (callbacks) {
      for (const cb of callbacks) {
        try {
          cb(msg);
        } catch {
          // Individual callback errors must not tear down the socket
        }
      }
    }
  }

  private send(msg: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private scheduleReconnect(): void {
    if (this.destroyed) return;
    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      this.backoffMs = Math.min(this.backoffMs * BACKOFF_MULTIPLIER, MAX_BACKOFF_MS);
      this.openConnection();
    }, this.backoffMs);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

// ─── Type guard ───────────────────────────────────────────────────────────────

function isWsNoteEvent(v: unknown): v is WsNoteEvent {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as Record<string, unknown>)['tag'] === 'string' &&
    typeof (v as Record<string, unknown>)['type'] === 'string' &&
    typeof (v as Record<string, unknown>)['payload'] === 'object'
  );
}
