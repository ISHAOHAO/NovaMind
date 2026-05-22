"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface UseWebSocketOptions {
  onForceLogout?: () => void;
  onError?: (error: string) => void;
}

const MAX_RECONNECT_ATTEMPTS = 5;
const PING_INTERVAL = 30000;

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [isOnline, setIsOnline] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const intentionalCloseRef = useRef(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const stopPing = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  const startPing = useCallback((ws: WebSocket) => {
    stopPing();
    pingIntervalRef.current = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping" }));
      }
    }, PING_INTERVAL);
  }, [stopPing]);

  const clearReconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const disconnect = useCallback(() => {
    intentionalCloseRef.current = true;
    clearReconnect();
    stopPing();
    reconnectAttemptsRef.current = 0;

    if (wsRef.current) {
      wsRef.current.close(1000, "主动断开");
      wsRef.current = null;
    }

    setIsConnected(false);
    setIsOnline(false);
  }, [clearReconnect, stopPing]);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("novamind_token")
        : null;
    if (!token) return;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return;
    }

    const wsUrl =
      process.env.NEXT_PUBLIC_WS_URL ||
      `ws://${typeof window !== "undefined" ? window.location.hostname : "localhost"}:3001`;

    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
    } catch {
      return;
    }

    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      ws.send(JSON.stringify({ type: "auth", token }));
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;

      let data: { type: string; [key: string]: unknown };
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }

      switch (data.type) {
        case "auth_ok":
          reconnectAttemptsRef.current = 0;
          setIsConnected(true);
          setIsOnline(true);
          startPing(ws);
          break;

        case "auth_error":
          setIsConnected(false);
          setIsOnline(false);
          optionsRef.current.onError?.(data.message as string);
          disconnect();
          break;

        case "pong":
          break;

        case "force_logout":
          optionsRef.current.onForceLogout?.();
          localStorage.removeItem("novamind_token");
          localStorage.removeItem("novamind_user");
          disconnect();
          if (typeof window !== "undefined") {
            window.location.href = "/login";
          }
          break;

        case "error":
          optionsRef.current.onError?.(data.message as string);
          break;
      }
    };

    ws.onclose = (event) => {
      if (!mountedRef.current) return;

      setIsConnected(false);
      setIsOnline(false);
      stopPing();

      if (intentionalCloseRef.current) {
        intentionalCloseRef.current = false;
        return;
      }

      if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        const delay = Math.min(
          1000 * Math.pow(2, reconnectAttemptsRef.current),
          30000
        );
        reconnectAttemptsRef.current += 1;

        reconnectTimerRef.current = setTimeout(() => {
          if (mountedRef.current) {
            connect();
          }
        }, delay);
      }
    };

    ws.onerror = () => {
      setIsConnected(false);
    };
  }, [disconnect, startPing, stopPing]);

  useEffect(() => {
    mountedRef.current = true;
    intentionalCloseRef.current = false;
    connect();

    return () => {
      mountedRef.current = false;
      intentionalCloseRef.current = true;
      clearReconnect();
      stopPing();
      if (wsRef.current) {
        wsRef.current.close(1000, "组件卸载");
        wsRef.current = null;
      }
    };
  }, []);

  return { isConnected, isOnline, connect, disconnect };
}
