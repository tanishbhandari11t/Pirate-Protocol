import { GameEventType, GameEventView } from '../common/game-events';

/** Thin frontend aliases derived from canonical game:event rows. */
export function aliasesFor(event: GameEventView, code: string): { event: string; payload: Record<string, unknown> }[] {
  const payload = { ...event.payload, code, playerId: event.playerId };
  switch (event.type) {
    case GameEventType.PUZZLE_SOLVED:
      return [{ event: 'puzzle:solved', payload }];
    case GameEventType.PUZZLE_FAILED:
      return [{ event: 'puzzle:failed', payload }];
    case GameEventType.TRAP_TRIGGERED:
      return [{ event: 'trap:triggered', payload }];
    case GameEventType.ITEM_GRANTED:
      return [
        { event: 'item:acquired', payload },
        { event: 'inventory:updated', payload },
      ];
    case GameEventType.TRADED:
      return [{ event: 'trade:accepted', payload }];
    case GameEventType.TREASURE_FOUND:
      return [
        { event: 'treasure:unlocked', payload },
        { event: 'game:finished', payload },
      ];
    case GameEventType.ISLAND_DISCOVERED:
      return [
        { event: 'island:discovered', payload },
        { event: 'map:updated', payload },
      ];
    case GameEventType.ISLAND_EXPLORED:
      return [{ event: 'island:explored', payload }];
    case GameEventType.CLUE_FOUND:
      return [{ event: 'puzzle:found', payload }];
    case GameEventType.MOVED:
      return [
        { event: 'map:move', payload },
        { event: 'map:updated', payload },
      ];
    default:
      return [];
  }
}
