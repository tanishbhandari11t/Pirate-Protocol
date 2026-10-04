import { io, type Socket } from "socket.io-client";
import {
  PROTOCOL_VERSION,
  type ClientRequestName,
  type ClientToServerEvents,
  type ErrorCode,
  type RequestPayload,
  type ResponseData,
  type ServerEventName,
  type ServerEvents,
  type ServerToClientEvents,
} from "./contract";

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export type ConnectionStatus = "idle" | "connecting" | "connected" | "reconnecting" | "offline";

export type ClientErrorCode = ErrorCode | "OFFLINE" | "TIMEOUT";

export type RequestResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ClientErrorCode; message: string } };

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4000";
const REQUEST_TIMEOUT_MS = 8000;
const CONNECT_TIMEOUT_MS = 6000;

let socket: GameSocket | null = null;
let status: ConnectionStatus = "idle";
const statusListeners = new Set<() => void>();

function setStatus(next: ConnectionStatus) {
  if (status === next) return;
  status = next;
  statusListeners.forEach((listener) => listener());
}

export function getSocket(): GameSocket {
  if (socket) return socket;

  socket = io(SOCKET_URL, {
    autoConnect: false,
    transports: ["websocket", "polling"],
    reconnectionDelay: 800,
    reconnectionDelayMax: 5000,
    auth: { protocol: PROTOCOL_VERSION },
  });

  socket.on("connect", () => setStatus("connected"));
  socket.on("disconnect", (reason) => {
    setStatus(reason === "io client disconnect" ? "idle" : "reconnecting");
  });
  socket.on("connect_error", () => {
    setStatus(socket?.active ? "reconnecting" : "offline");
  });
  socket.io.on("reconnect_attempt", () => setStatus("reconnecting"));
  socket.io.on("reconnect_failed", () => setStatus("offline"));

  return socket;
}

export function connectSocket() {
  const s = getSocket();
  if (!s.connected && !s.active) {
    setStatus("connecting");
    s.connect();
  }
  return s;
}

export function disconnectSocket() {
  socket?.disconnect();
}

export const connectionStore = {
  subscribe(listener: () => void) {
    statusListeners.add(listener);
    return () => statusListeners.delete(listener);
  },
  getSnapshot: (): ConnectionStatus => status,
  getServerSnapshot: (): ConnectionStatus => "idle",
};

function waitForConnection(s: GameSocket, timeoutMs: number): Promise<boolean> {
  if (s.connected) return Promise.resolve(true);
  connectSocket();
  return new Promise((resolve) => {
    const onConnect = () => {
      clearTimeout(timer);
      resolve(true);
    };
    const timer = setTimeout(() => {
      s.off("connect", onConnect);
      resolve(false);
    }, timeoutMs);
    s.once("connect", onConnect);
  });
}

type AckingEmitter = {
  emitWithAck: (event: string, payload: unknown) => Promise<unknown>;
};

/**
 * Sends a typed request and resolves with the server's acknowledgement.
 * Never throws: transport failures are mapped onto `OFFLINE` / `TIMEOUT` errors.
 */
export async function request<K extends ClientRequestName>(
  event: K,
  payload: RequestPayload<K>,
): Promise<RequestResult<ResponseData<K>>> {
  const s = getSocket();
  const connected = await waitForConnection(s, CONNECT_TIMEOUT_MS);
  if (!connected) {
    return {
      ok: false,
      error: { code: "OFFLINE", message: "The harbour is shrouded — the server cannot be reached." },
    };
  }

  try {
    const emitter = s.timeout(REQUEST_TIMEOUT_MS) as unknown as AckingEmitter;
    const response = (await emitter.emitWithAck(event, payload)) as RequestResult<ResponseData<K>>;
    return response;
  } catch {
    return {
      ok: false,
      error: { code: "TIMEOUT", message: "No reply from the harbour master. Try again." },
    };
  }
}

/** Subscribes to a typed server push. Returns an unsubscribe function. */
export function onServerEvent<K extends ServerEventName>(
  event: K,
  handler: (payload: ServerEvents[K]) => void,
): () => void {
  const s = getSocket() as unknown as {
    on: (e: string, h: (p: ServerEvents[K]) => void) => void;
    off: (e: string, h: (p: ServerEvents[K]) => void) => void;
  };
  s.on(event, handler);
  return () => s.off(event, handler);
}
