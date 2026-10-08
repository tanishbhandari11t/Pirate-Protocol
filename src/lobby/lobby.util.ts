import { randomBytes } from 'crypto';

export function makeGuestUsername(displayName: string) {
  const base = displayName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 10);
  const suffix = randomBytes(3).toString('hex');
  const stem = base.length >= 3 ? base : `sailor_${suffix}`;
  return `${stem}_${suffix}`.slice(0, 16);
}
