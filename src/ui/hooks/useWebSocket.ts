import { useEffect, useRef, useState, useCallback } from 'react';

/** Message received from WebSocket */
export interface WSMessage {
  type: string;
  [key: string]: unknown;
}

/** Return value of useWebSocket hook */
export interface UseWebSocketReturn {
  connected: boolean;
  lastMessage: WSMessage | null;
  send: (data: unknown) => void;
}

/** Options for configuring WebSocket behavior */
interface UseWebSocketOptions {
  /** URL to connect to. Defaults to ws://location.host */
  url?: string;
  /** Enable auto-reconnect. Default true */
  reconnect?: boolean;
  /** Heartbeat interval in ms. Default 30000 */
  heartbeatInterval?: number;
  /** Disable WebSocket connection entirely (e.g. for demo mode). Default false */
  disabled?: boolean;
}

const BASE_DELAY = 2000;
const MAX_DELAY = 30000;
const HEARTBEAT_INTERVAL = 30000;

/**
 * WebSocket connection hook with auto-reconnect and heartbeat.
 */
export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const {
    url,
    reconnect = true,
    heartbeatInterval = HEARTBEAT_INTERVAL,
    disabled = false,
  } = options;

  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unmountedRef = useRef(false);

  const getWsUrl = useCallback((): string => {
    if (url) return url;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}`;
  }, [url]);

  const clearTimers = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (heartbeatTimerRef.current !== null) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }, []);

  const startHeartbeat = useCallback(() => {
    heartbeatTimerRef.current = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, heartbeatInterval);
  }, [heartbeatInterval]);

  const connect = useCallback(() => {
    if (unmountedRef.current) return;

    const wsUrl = getWsUrl();
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (unmountedRef.current) return;
      setConnected(true);
      reconnectAttemptRef.current = 0;
      startHeartbeat();
    };

    ws.onmessage = (event: MessageEvent) => {
      if (unmountedRef.current) return;
      try {
        const data = JSON.parse(event.data as string) as WSMessage;
        // Ignore pong messages
        if (data.type !== 'pong') {
          setLastMessage(data);
        }
      } catch {
        // Ignore non-JSON messages
      }
    };

    ws.onclose = () => {
      if (unmountedRef.current) return;
      setConnected(false);
      clearTimers();

      if (reconnect) {
        const attempt = reconnectAttemptRef.current;
        const delay = Math.min(BASE_DELAY * Math.pow(2, attempt), MAX_DELAY);
        reconnectAttemptRef.current = attempt + 1;
        reconnectTimerRef.current = setTimeout(connect, delay);
      }
    };

    ws.onerror = () => {
      // Will trigger onclose, handled there
      ws.close();
    };
  }, [getWsUrl, reconnect, startHeartbeat, clearTimers]);

  const send = useCallback((data: unknown) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  useEffect(() => {
    if (disabled) {
      setConnected(true);
      return;
    }
    unmountedRef.current = false;
    connect();

    return () => {
      unmountedRef.current = true;
      clearTimers();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect, clearTimers, disabled]);

  return { connected, lastMessage, send };
}
