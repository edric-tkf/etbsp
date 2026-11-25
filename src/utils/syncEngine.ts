import type {
  CustomFont,
  DisplaySettings,
  PresentationState,
  SyncConnectionState,
} from '../types/models';
import { LS_KEYS } from './storage';

export const SYNC_CHANNEL_NAME = 'et-bsp-sync';

export type SyncMessage =
  | { type: 'presentation:update'; payload: PresentationState; senderId: string }
  | { type: 'settings:update'; payload: DisplaySettings; senderId: string }
  | { type: 'fonts:update'; payload: CustomFont[]; senderId: string }
  | { type: 'request:sync'; senderId: string }
  | { type: 'server:hello'; version: string; bootId: string }
  | { type: 'presence'; connectedDisplays: number; connectedPanels: number; timestamp: number };

export interface SyncControllerCallbacks {
  onPresentationUpdate?: (state: PresentationState) => void;
  onSettingsUpdate?: (settings: DisplaySettings) => void;
  onFontsUpdate?: (fonts: CustomFont[]) => void;
  onSyncRequested?: () => void;
  onServerHello?: (info: { version: string; bootId: string }) => void;
  onStatusChange?: (status: SyncConnectionState) => void;
}

export class PresentationSyncClient {
  private role: 'panel' | 'display';
  private clientId: string;
  private channel: BroadcastChannel | null = null;
  private ws: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private reconnectAttempt = 0;
  private disposed = false;
  private callbacks: SyncControllerCallbacks;
  private status: SyncConnectionState = {
    wsStatus: 'disconnected',
    broadcastChannelAvailable: typeof BroadcastChannel !== 'undefined',
    connectedDisplays: 0,
    lastSyncedAt: null,
  };

  constructor(role: 'panel' | 'display', callbacks: SyncControllerCallbacks) {
    this.role = role;
    this.clientId = `${role}-${Math.random().toString(36).slice(2, 10)}`;
    this.callbacks = callbacks;
    this.init();
  }

  private updateStatus(patch: Partial<SyncConnectionState>) {
    this.status = { ...this.status, ...patch };
    this.callbacks.onStatusChange?.(this.status);
  }

  private init() {
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.channel = new BroadcastChannel(SYNC_CHANNEL_NAME);
        this.channel.onmessage = (event: MessageEvent<SyncMessage>) => {
          this.handleIncomingMessage(event.data);
        };
      } catch {
        this.updateStatus({ broadcastChannelAvailable: false });
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', this.handleStorageEvent);
      window.addEventListener('message', this.handlePostMessage);
    }

    this.connectWebSocket();

    if (this.role === 'display') {
      this.requestSync();
    }
  }

  private handleStorageEvent = (e: StorageEvent) => {
    if (!e.newValue) return;
    try {
      if (e.key === LS_KEYS.PRESENTATION) {
        const parsed = JSON.parse(e.newValue) as PresentationState;
        this.callbacks.onPresentationUpdate?.(parsed);
        this.updateStatus({ lastSyncedAt: Date.now() });
      } else if (e.key === LS_KEYS.DISPLAY_SETTINGS) {
        const parsed = JSON.parse(e.newValue) as DisplaySettings;
        this.callbacks.onSettingsUpdate?.(parsed);
        this.updateStatus({ lastSyncedAt: Date.now() });
      } else if (e.key === LS_KEYS.CUSTOM_FONTS) {
        const parsed = JSON.parse(e.newValue) as CustomFont[];
        this.callbacks.onFontsUpdate?.(parsed);
        this.updateStatus({ lastSyncedAt: Date.now() });
      }
    } catch {
      // Ignore malformed storage JSON
    }
  };

  private handlePostMessage = (e: MessageEvent) => {
    if (!e.data || typeof e.data !== 'object') return;
    if (e.data.__bspSync) {
      this.handleIncomingMessage(e.data.__bspSync as SyncMessage);
    }
  };

  private handleIncomingMessage(msg: SyncMessage) {
    if (!msg || typeof msg !== 'object') return;
    if ('senderId' in msg && msg.senderId === this.clientId) return;

    if (msg.type === 'presentation:update') {
      this.callbacks.onPresentationUpdate?.(msg.payload);
      this.updateStatus({ lastSyncedAt: Date.now() });
    } else if (msg.type === 'settings:update') {
      this.callbacks.onSettingsUpdate?.(msg.payload);
      this.updateStatus({ lastSyncedAt: Date.now() });
    } else if (msg.type === 'fonts:update') {
      this.callbacks.onFontsUpdate?.(msg.payload);
      this.updateStatus({ lastSyncedAt: Date.now() });
    } else if (msg.type === 'request:sync') {
      this.callbacks.onSyncRequested?.();
    } else if (msg.type === 'server:hello') {
      this.callbacks.onServerHello?.({ version: msg.version, bootId: msg.bootId });
    } else if (msg.type === 'presence') {
      this.updateStatus({ connectedDisplays: msg.connectedDisplays });
    }
  }

  private connectWebSocket() {
    if (this.disposed || typeof window === 'undefined') return;
    if (!window.location.host || window.location.protocol === 'file:') {
      this.updateStatus({ wsStatus: 'disconnected' });
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      this.ws = new WebSocket(wsUrl);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectAttempt = 0;
      this.updateStatus({ wsStatus: 'connected', lastSyncedAt: Date.now() });
      this.ws?.send(
        JSON.stringify({
          type: 'register',
          role: this.role,
          clientId: this.clientId,
        })
      );
      if (this.heartbeatTimer) window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = window.setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 20000);
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(String(event.data)) as SyncMessage;
        this.handleIncomingMessage(msg);
      } catch {
        // Ignore non-JSON frames
      }
    };

    this.ws.onclose = () => {
      if (this.heartbeatTimer) {
        window.clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
      }
      if (!this.disposed) {
        this.updateStatus({ wsStatus: 'reconnecting' });
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      // onclose handles reconnect cleanly
    };
  }

  private scheduleReconnect() {
    if (this.disposed || this.reconnectTimer !== null) return;
    const delay = Math.min(8000, 750 * Math.pow(1.5, this.reconnectAttempt));
    this.reconnectAttempt += 1;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connectWebSocket();
    }, delay);
  }

  public publishPresentation(state: PresentationState) {
    const msg: SyncMessage = {
      type: 'presentation:update',
      payload: state,
      senderId: this.clientId,
    };
    this.emit(msg);
  }

  public publishSettings(settings: DisplaySettings) {
    const msg: SyncMessage = {
      type: 'settings:update',
      payload: settings,
      senderId: this.clientId,
    };
    this.emit(msg);
  }

  public publishFonts(fonts: CustomFont[]) {
    const msg: SyncMessage = {
      type: 'fonts:update',
      payload: fonts,
      senderId: this.clientId,
    };
    this.emit(msg);
  }

  public requestSync() {
    const msg: SyncMessage = { type: 'request:sync', senderId: this.clientId };
    this.emit(msg);
  }

  private emit(msg: SyncMessage) {
    if (this.channel) {
      try {
        this.channel.postMessage(msg);
      } catch {
        // Ignore
      }
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(msg));
      } catch {
        // Ignore
      }
    }
    if (typeof window !== 'undefined' && window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage({ __bspSync: msg }, window.location.origin);
      } catch {
        // Ignore cross-origin
      }
    }
    this.updateStatus({ lastSyncedAt: Date.now() });
  }

  public getStatus(): SyncConnectionState {
    return this.status;
  }

  public dispose() {
    this.disposed = true;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
    }
    if (this.heartbeatTimer !== null) {
      window.clearInterval(this.heartbeatTimer);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', this.handleStorageEvent);
      window.removeEventListener('message', this.handlePostMessage);
    }
    this.channel?.close();
    this.ws?.close();
  }
}
