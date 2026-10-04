"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { connectionStore, onServerEvent, type ConnectionStatus } from "./client";
import type { ServerEventName, ServerEvents } from "./contract";

export function useConnectionStatus(): ConnectionStatus {
  return useSyncExternalStore(
    connectionStore.subscribe,
    connectionStore.getSnapshot,
    connectionStore.getServerSnapshot,
  );
}

/** Subscribes to a server push for the lifetime of the component; the handler may change freely. */
export function useServerEvent<K extends ServerEventName>(
  event: K,
  handler: (payload: ServerEvents[K]) => void,
) {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => onServerEvent(event, (payload) => handlerRef.current(payload)), [event]);
}
