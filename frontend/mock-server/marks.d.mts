import type { Server, Socket } from "socket.io";

export interface MarkSeat {
  roomCode: string;
  playerId: string;
  canMark: boolean;
}

export interface ServerMark {
  id: string;
  playerId: string;
  kind: "pin" | "danger" | "treasure" | "route";
  points: { x: number; y: number }[];
  createdAt: number;
  expiresAt: number;
}

export declare const MARK_KINDS: ReadonlySet<string>;
export declare const MARK_LIMITS: Readonly<{
  perSailor: number;
  routePoints: number;
  minRouteLength: number;
  ttlMs: number;
  perMinute: number;
}>;

export declare function cleanMarkRequest(input: unknown): Pick<ServerMark, "kind" | "points"> | null;

export declare function attachMapMarks(
  io: Server,
  options: { seatOf: (socket: Socket) => MarkSeat | null; now?: () => number },
): {
  sendTo(socket: Socket, roomCode: string): void;
  forgetRoom(roomCode: string): void;
  marksOf(roomCode: string): ServerMark[];
  stop(): void;
};
