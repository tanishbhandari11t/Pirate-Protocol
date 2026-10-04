/**
 * Which server the frontend talks to.
 *
 *  - `protocol` (default): a server speaking `contract.ts` directly, i.e. `npm run mock:server`.
 *  - `nest`: Person A's NestJS game server. `lib/socket/nest/` translates between the two, and
 *    features that server does not offer are switched off through `CAPABILITIES`.
 */
export type BackendMode = "protocol" | "nest";

export const BACKEND: BackendMode = process.env.NEXT_PUBLIC_BACKEND === "nest" ? "nest" : "protocol";

export const SERVER_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4000";

export interface Capabilities {
  /** Sailors pick a likeness that the whole crew sees. */
  avatars: boolean;
  /** Ready flags and a captain's countdown gate the voyage. */
  readyUp: boolean;
  kick: boolean;
  /** The captain can rewrite the ship's articles. */
  articles: boolean;
  chat: boolean;
  hints: boolean;
  /** The server publishes scores and standings. */
  scores: boolean;
  spectate: boolean;
  /** Timed voyages with a tide clock. */
  clock: boolean;
  /** Fog hides islands until someone lands on them. */
  fog: boolean;
  /** Sailors' outfits and flags travel to the rest of the crew. */
  outfits: boolean;
  /** Pins, warnings and routes shared on the chart (`map:mark`). */
  marks: boolean;
  /** Captain's Gambit dice duels (`gambit:*`). */
  gambit: boolean;
}

const FULL: Capabilities = {
  avatars: true,
  readyUp: true,
  kick: true,
  articles: true,
  chat: true,
  hints: true,
  scores: true,
  spectate: true,
  clock: true,
  fog: true,
  outfits: true,
  marks: true,
  gambit: true,
};

const NEST: Capabilities = {
  avatars: false,
  readyUp: false,
  kick: false,
  articles: false,
  chat: false,
  hints: false,
  scores: false,
  spectate: false,
  clock: false,
  fog: true,
  outfits: false,
  marks: false,
  gambit: false,
};

export const CAPABILITIES: Capabilities = BACKEND === "nest" ? NEST : FULL;
