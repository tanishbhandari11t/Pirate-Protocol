import type { Server, Socket } from "socket.io";
import type { GambitDuel } from "../src/lib/socket/gambit";

export declare const GAMBIT_RULES: Readonly<{
  dicePerRoll: number;
  roundsToWin: number;
  maxRounds: number;
  answerWindowMs: number;
  roundGapMs: number;
  cooldownMs: number;
}>;

export declare function attachGambit(
  io: Server,
  options: {
    seatOf: (socket: Socket) => { roomCode: string; playerId: string } | null;
    now?: () => number;
    roundGapMs?: number;
  },
): {
  forfeit(playerId: string): void;
  duelsOf(roomCode: string): GambitDuel[];
};
