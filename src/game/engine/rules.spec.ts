import 'reflect-metadata';
import { signToken, verifyToken } from '../../auth/token';
import { parseDto } from '../../common/parse-dto';
import { makeRoomCode, ROOM_CODE_PATTERN } from '../../rooms/room-code';
import { toPublicPuzzle } from '../../rooms/room.types';
import { WsJoinDto } from '../../websocket/dto';
import { hashAnswer, normalizeAnswer } from './answer';
import { ITEM_CATALOG } from '../inventory/catalog';
import { applyStrike } from '../traps/traps';
import { REQUIRED_RELICS, missingRelics } from '../treasure/relics';

describe('game rules', () => {
  it('normalizes answers before hashing', () => {
    expect(normalizeAnswer('  Pirate   Protocol ')).toBe('pirate protocol');
    expect(hashAnswer('  Pirate   Protocol ', 'pepper')).toBe(hashAnswer('pirate protocol', 'pepper'));
    expect(hashAnswer('map', 'a')).not.toBe(hashAnswer('map', 'b'));
  });

  it('names every relic the vault requires', () => {
    expect(missingRelics(['compass'])).toEqual(['spyglass', 'serpent-key', 'widow-chart', 'gold-seal']);
    expect(missingRelics([...REQUIRED_RELICS])).toEqual([]);
    for (const key of REQUIRED_RELICS) expect(ITEM_CATALOG[key]).toBeDefined();
  });

  it('eliminates a sailor on the third trap', () => {
    expect(applyStrike(1)).toEqual({ strikes: 2, isEliminated: false });
    expect(applyStrike(2)).toEqual({ strikes: 3, isEliminated: true });
  });

  it('issues room codes from the unambiguous alphabet', () => {
    for (let i = 0; i < 30; i++) expect(makeRoomCode()).toMatch(ROOM_CODE_PATTERN);
  });

  it('round-trips and rejects auth tokens', () => {
    const secret = 'secret-secret-secret';
    const signed = signToken('user_1', secret, 1_000);
    expect(verifyToken(signed.token, secret, 1_000)).toEqual({ userId: 'user_1' });
    expect(() => verifyToken(`${signed.token}x`, secret, 1_000)).toThrow();
    expect(() => verifyToken(signed.token, secret, 1_000 + 8 * 24 * 60 * 60 * 1000)).toThrow();
  });

  it('never puts puzzle secrets on the public puzzle shape', () => {
    expect(Object.keys(toPublicPuzzle({
      id: '1',
      key: 'port-royal-map',
      prompt: 'What am I?',
      cipher: 'riddle',
      order: 1,
    }))).toEqual(['id', 'key', 'prompt', 'cipher', 'order']);
  });

  it('parses a socket join code', async () => {
    await expect(parseDto(WsJoinDto, { code: 'ab23cd' })).resolves.toMatchObject({ code: 'AB23CD' });
    await expect(parseDto(WsJoinDto, { code: 'contains-zero' })).rejects.toThrow();
  });
});
