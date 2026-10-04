/** The slice of a socket.io client that add-on features need, so they work with any wrapper. */
export interface AckSocket {
  on(event: string, listener: (payload: never) => void): unknown;
  off(event: string, listener: (payload: never) => void): unknown;
  emit(event: string, payload: unknown, ack: (response: unknown) => void): unknown;
}

export interface AckFailure {
  code: string;
  message: string;
}

type Ack<T> = { ok: true; data: T } | { ok: false; error: AckFailure };

export const ACK_TIMEOUT_MS = 5_000;

/** Emits a request and resolves with the server's data, or rejects with its `{ code, message }`. */
export function emitWithAck<T>(socket: AckSocket, event: string, payload: unknown, timeoutMs = ACK_TIMEOUT_MS): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject({ code: "TIMEOUT", message: "No answer" } satisfies AckFailure), timeoutMs);
    socket.emit(event, payload, (response) => {
      clearTimeout(timer);
      const ack = response as Ack<T>;
      if (ack?.ok) resolve(ack.data);
      else reject(ack?.error ?? ({ code: "UNKNOWN", message: "Unknown error" } satisfies AckFailure));
    });
  });
}
