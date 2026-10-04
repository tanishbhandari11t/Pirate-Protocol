import {
  CREW_NAME_MAX,
  PLAYER_NAME_MAX,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
} from "./socket/contract";

export function normalizeName(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function validatePlayerName(value: string): string | null {
  const name = normalizeName(value);
  if (name.length < 2) return "Every pirate needs a name of at least 2 letters.";
  if (name.length > PLAYER_NAME_MAX) return `Keep it under ${PLAYER_NAME_MAX} letters, sailor.`;
  if (!/^[\p{L}\p{N} '_.-]+$/u.test(name)) return "Only letters, numbers and simple marks.";
  return null;
}

export function validateCrewName(value: string): string | null {
  const name = normalizeName(value);
  if (name.length < 3) return "A crew name needs at least 3 letters.";
  if (name.length > CREW_NAME_MAX) return `Keep it under ${CREW_NAME_MAX} letters.`;
  if (!/^[\p{L}\p{N} '_.&!-]+$/u.test(name)) return "Only letters, numbers and simple marks.";
  return null;
}

export function sanitizeRoomCode(value: string) {
  const allowed = new Set(ROOM_CODE_ALPHABET);
  return value
    .toUpperCase()
    .split("")
    .filter((c) => allowed.has(c))
    .join("")
    .slice(0, ROOM_CODE_LENGTH);
}

export function validateRoomCode(value: string): string | null {
  if (sanitizeRoomCode(value).length !== ROOM_CODE_LENGTH) {
    return `The code has ${ROOM_CODE_LENGTH} runes.`;
  }
  return null;
}
