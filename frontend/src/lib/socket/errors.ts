import type { ClientErrorCode } from "./client";

const PIRATE_MESSAGES: Record<ClientErrorCode, string> = {
  INVALID_PAYLOAD: "The ship's articles are smudged. Check your details and try again.",
  ROOM_NOT_FOUND: "No crew sails under that code. Check it with your captain.",
  ROOM_FULL: "That ship's hold is full — every berth is taken.",
  GAME_IN_PROGRESS: "That crew has already set sail.",
  NAME_TAKEN: "A sailor by that name already serves aboard. Choose another.",
  NOT_IN_ROOM: "You are not aboard this vessel.",
  NOT_CAPTAIN: "Only the captain may give that order.",
  NOT_ENOUGH_PLAYERS: "Too few hands on deck to set sail.",
  PLAYERS_NOT_READY: "Not every sailor is ready to weigh anchor.",
  SESSION_EXPIRED: "Your berth was given away. Board the ship anew.",
  NOT_IN_GAME: "The voyage has not begun.",
  RATE_LIMITED: "Easy, sailor — too many orders at once.",
  INTERNAL: "A storm struck the harbour. Try again shortly.",
  OFFLINE: "The harbour is shrouded — the server cannot be reached.",
  TIMEOUT: "No reply from the harbour master. Try again.",
};

export function describeError(code: ClientErrorCode, fallback?: string): string {
  return PIRATE_MESSAGES[code] ?? fallback ?? PIRATE_MESSAGES.INTERNAL;
}
