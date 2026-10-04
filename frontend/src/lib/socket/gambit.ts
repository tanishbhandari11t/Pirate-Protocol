/**
 * Captain's Gambit: a best-of-three dice duel between two sailors of the same crew.
 *
 *   client → server  "gambit:challenge"  { toPlayerId }        ack → GambitDuel
 *   client → server  "gambit:respond"    { duelId, accept }    ack → GambitDuel
 *   server → client  "gambit:update"     GambitDuel            to both duellists, on every change
 *
 * The server rolls every die and decides every round. Stakes are honour only: nothing changes
 * hands, so the duel never touches the trading rules.
 */

export type GambitStatus = "pending" | "declined" | "expired" | "rolling" | "done";

export interface GambitRound {
  challenger: number[];
  defender: number[];
  /** `null` for a drawn round. */
  winner: "challenger" | "defender" | null;
}

export interface GambitDuel {
  id: string;
  roomCode: string;
  challengerId: string;
  defenderId: string;
  status: GambitStatus;
  rounds: GambitRound[];
  winnerId: string | null;
  createdAt: number;
  /** When an unanswered challenge lapses (epoch ms). */
  expiresAt: number;
}

export interface GambitChallengePayload {
  toPlayerId: string;
}

export interface GambitRespondPayload {
  duelId: string;
  accept: boolean;
}

export const diceTotal = (dice: readonly number[]) => dice.reduce((a, b) => a + b, 0);

export function roundsWon(duel: GambitDuel, side: "challenger" | "defender") {
  return duel.rounds.filter((r) => r.winner === side).length;
}

export function isLiveDuel(duel: GambitDuel) {
  return duel.status === "pending" || duel.status === "rolling";
}
