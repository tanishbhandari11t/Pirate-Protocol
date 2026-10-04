import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { io as connect, type Socket } from "socket.io-client";
import { PROTOCOL_VERSION } from "@/lib/socket/contract";

export type Ack<T = unknown> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

/** Asks the OS for a port nobody is using, so parallel runs never collide. */
export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.unref();
    probe.on("error", reject);
    probe.listen(0, () => {
      const address = probe.address();
      const port = typeof address === "object" && address ? address.port : 0;
      probe.close(() => resolve(port));
    });
  });
}

export interface MockServer {
  url: string;
  stop(): Promise<void>;
}

/** Boots a fresh mock server process; every test file gets its own clean world. */
export async function startMockServer(script = "mock-server/lobby.mjs", env: Record<string, string> = {}): Promise<MockServer> {
  const port = await freePort();
  const child: ChildProcess = spawn(process.execPath, [script], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port), ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Mock server did not start:\n${output}`)), 10_000);
    const onData = (chunk: Buffer) => {
      output += chunk.toString();
      if (/listening|mock server .* on http/i.test(output)) {
        clearTimeout(timer);
        resolve();
      }
    };
    child.stdout?.on("data", onData);
    child.stderr?.on("data", (chunk: Buffer) => (output += chunk.toString()));
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Mock server exited with ${code}:\n${output}`));
    });
  });

  return {
    url: `http://127.0.0.1:${port}`,
    stop: () =>
      new Promise((resolve) => {
        if (child.exitCode !== null) return resolve();
        child.once("exit", () => resolve());
        child.kill();
      }),
  };
}

/** One simulated player: a real socket.io client plus helpers that make scenarios read like a script. */
export class Sailor {
  readonly socket: Socket;
  private seen: { event: string; payload: unknown }[] = [];

  constructor(
    url: string,
    readonly label: string,
  ) {
    this.socket = connect(url, { transports: ["websocket"], forceNew: true, reconnection: false, auth: { protocol: PROTOCOL_VERSION } });
    this.socket.onAny((event: string, payload: unknown) => this.seen.push({ event, payload }));
  }

  connected() {
    if (this.socket.connected) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      this.socket.once("connect", () => resolve());
      this.socket.once("connect_error", reject);
    });
  }

  request<T = unknown>(event: string, payload?: unknown, timeoutMs = 3_000): Promise<Ack<T>> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${this.label}: no ack for ${event}`)), timeoutMs);
      this.socket.emit(event, payload, (ack: Ack<T>) => {
        clearTimeout(timer);
        resolve(ack);
      });
    });
  }

  /** Like request, but fails the test if the server refuses. */
  async must<T = unknown>(event: string, payload?: unknown): Promise<T> {
    const ack = await this.request<T>(event, payload);
    if (!ack.ok) throw new Error(`${this.label}: ${event} refused with ${ack.error.code}`);
    return ack.data;
  }

  /**
   * Resolves with the first payload of `event` matching `where`, including ones that already arrived,
   * so a test never races the server.
   */
  waitFor<T = unknown>(event: string, where: (payload: T) => boolean = () => true, timeoutMs = 3_000): Promise<T> {
    const past = this.seen.find((s) => s.event === event && where(s.payload as T));
    if (past) return Promise.resolve(past.payload as T);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.socket.off(event, listener);
        reject(new Error(`${this.label}: timed out waiting for ${event}`));
      }, timeoutMs);
      const listener = (payload: T) => {
        if (!where(payload)) return;
        clearTimeout(timer);
        this.socket.off(event, listener);
        resolve(payload);
      };
      this.socket.on(event, listener);
    });
  }

  /** Forgets events received so far, so the next waitFor only sees what happens after this point. */
  clearSeen() {
    this.seen = [];
  }

  events(event: string) {
    return this.seen.filter((s) => s.event === event).map((s) => s.payload);
  }

  close() {
    this.socket.disconnect();
  }
}

export async function sailors(url: string, ...labels: string[]) {
  const crew = labels.map((label) => new Sailor(url, label));
  await Promise.all(crew.map((s) => s.connected()));
  return crew;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
