import { GameEventType } from '../common/game-events';

const POINTS: Record<string, number> = {
  [GameEventType.PUZZLE_SOLVED]: 100,
  [GameEventType.ISLAND_DISCOVERED]: 25,
  [GameEventType.ISLAND_EXPLORED]: 15,
  [GameEventType.ITEM_GRANTED]: 10,
  [GameEventType.TRADED]: 5,
  [GameEventType.TRAP_TRIGGERED]: -30,
  [GameEventType.PUZZLE_FAILED]: -5,
  [GameEventType.TREASURE_FOUND]: 500,
};

/** Event types needed for scores / progress / discovery / clues / winner — not the full log. */
export const ROOM_META_EVENT_TYPES = [
  GameEventType.PUZZLE_SOLVED,
  GameEventType.PUZZLE_FAILED,
  GameEventType.TRAP_TRIGGERED,
  GameEventType.ITEM_GRANTED,
  GameEventType.TRADED,
  GameEventType.TREASURE_FOUND,
  GameEventType.ISLAND_DISCOVERED,
  GameEventType.ISLAND_EXPLORED,
  GameEventType.CLUE_FOUND,
] as const;

export function scoreFromEvents(events: { type: string; playerId: string | null }[]) {
  const totals = new Map<string, number>();
  for (const event of events) {
    if (!event.playerId) continue;
    const delta = POINTS[event.type] ?? 0;
    if (delta === 0) continue;
    totals.set(event.playerId, (totals.get(event.playerId) ?? 0) + delta);
  }
  return [...totals.entries()].map(([playerId, points]) => ({ playerId, points }));
}
