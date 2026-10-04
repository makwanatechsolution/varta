/**
 * Varta WebSocket Manager
 * Replaces Supabase Realtime. Connects to our GCP Express server's WS endpoint.
 * Handles auto-reconnect, subscriptions, and event routing.
 */

import { firebaseAuth } from "./firebase";

const WS_URL = (() => {
  const apiUrl = (import.meta.env.VITE_API_URL as string | undefined) || "";
  if (apiUrl) {
    return apiUrl.replace(/^http/, "ws").replace(/\/$/, "") + "/ws";
  }
  // Relative: same host, switch protocol
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}/ws`;
})();

type EventCallback = (payload: unknown) => void;

interface Subscription {
  channel: string;
  event: string;
  callback: EventCallback;
}

class VartaWS {
  private ws: WebSocket | null = null;
  private subs: Subscription[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectDelay = 30_000;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private connected = false;

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      return;
    }

    firebaseAuth.currentUser
      ?.getIdToken()
      .then((token) => {
        const url = token ? `${WS_URL}?token=${encodeURIComponent(token)}` : WS_URL;
        this.ws = new WebSocket(url);
        this.ws.onopen = this.onOpen.bind(this);
        this.ws.onclose = this.onClose.bind(this);
        this.ws.onerror = this.onError.bind(this);
        this.ws.onmessage = this.onMessage.bind(this);
      })
      .catch(() => {
        const url = WS_URL;
        this.ws = new WebSocket(url);
        this.ws.onopen = this.onOpen.bind(this);
        this.ws.onclose = this.onClose.bind(this);
        this.ws.onerror = this.onError.bind(this);
        this.ws.onmessage = this.onMessage.bind(this);
      });
  }

  private onOpen() {
    console.log("[VartaWS] Connected");
    this.connected = true;
    this.reconnectAttempts = 0;
    // Resubscribe to all active channels
    for (const sub of this.subs) {
      this.sendSubscribe(sub.channel);
    }
    // Heartbeat ping every 25s
    this.heartbeatTimer = setInterval(() => {
      this.send({ type: "ping" });
    }, 25_000);
  }

  private onClose() {
    console.log("[VartaWS] Disconnected, reconnecting...");
    this.connected = false;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.scheduleReconnect();
  }

  private onError(err: Event) {
    console.warn("[VartaWS] Error:", err);
  }

  private onMessage(event: MessageEvent) {
    try {
      const msg = JSON.parse(event.data as string) as {
        type: string;
        channel: string;
        event: string;
        payload: unknown;
      };
      if (msg.type === "pong") return;
      if (msg.type === "event" || msg.type === "broadcast") {
        this.dispatch(msg.channel, msg.event, msg.payload);
      }
    } catch { /* ignore bad messages */ }
  }

  private dispatch(channel: string, event: string, payload: unknown) {
    for (const sub of this.subs) {
      if (sub.channel === channel && (sub.event === event || sub.event === "*")) {
        try {
          sub.callback(payload);
        } catch (e) {
          console.warn("[VartaWS] Callback error:", e);
        }
      }
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, this.maxReconnectDelay);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private send(msg: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private sendSubscribe(channel: string) {
    this.send({ type: "subscribe", channel });
  }

  private sendUnsubscribe(channel: string) {
    this.send({ type: "unsubscribe", channel });
  }

  /**
   * Subscribe to a channel/event combination.
   * Returns an unsubscribe function.
   */
  on(channel: string, event: string, callback: EventCallback): () => void {
    const sub: Subscription = { channel, event, callback };
    this.subs.push(sub);

    // Subscribe to channel on server if not already
    const already = this.subs.filter((s) => s.channel === channel).length > 1;
    if (!already) {
      this.sendSubscribe(channel);
    }

    return () => this.off(channel, event, callback);
  }

  off(channel: string, event: string, callback: EventCallback) {
    this.subs = this.subs.filter(
      (s) => !(s.channel === channel && s.event === event && s.callback === callback),
    );
    // Unsubscribe from channel if no more listeners
    const remaining = this.subs.filter((s) => s.channel === channel).length;
    if (remaining === 0) {
      this.sendUnsubscribe(channel);
    }
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.ws?.close();
    this.ws = null;
    this.connected = false;
  }

  isConnected() {
    return this.connected;
  }
}

// Singleton
export const vartaWS = new VartaWS();

// Auto-connect when Firebase auth is ready
import { onAuthStateChanged } from "firebase/auth";
onAuthStateChanged(firebaseAuth, (user) => {
  if (user) {
    vartaWS.connect();
  } else {
    vartaWS.disconnect();
  }
});
