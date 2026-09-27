import { MAX_STRIKES } from '../treasure/relics';

export function applyStrike(strikes: number) {
  const next = strikes + 1;
  return { strikes: next, isEliminated: next >= MAX_STRIKES };
}
