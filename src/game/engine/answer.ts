import { createHash } from 'crypto';

export function normalizeAnswer(answer: string) {
  return answer.trim().toLowerCase().replace(/\s+/g, ' ');
}

// ponytail: static hashed answers — generate puzzles per room when clues should not live in the repo.
export function hashAnswer(answer: string, pepper: string) {
  return createHash('sha256').update(`${pepper}:${normalizeAnswer(answer)}`).digest('hex');
}
