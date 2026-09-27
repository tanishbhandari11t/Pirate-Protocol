import { createHmac, timingSafeEqual } from 'crypto';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export class AuthError extends Error {
  constructor() {
    super('Invalid token');
  }
}

export function signToken(userId: string, secret: string, now = Date.now()) {
  const exp = now + SEVEN_DAYS_MS;
  const body = Buffer.from(JSON.stringify({ userId, exp })).toString('base64url');
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return { token: `${body}.${sig}`, expiresAt: new Date(exp).toISOString() };
}

export function verifyToken(token: string, secret: string, now = Date.now()): { userId: string } {
  const [body, sig, extra] = token.split('.');
  if (!body || !sig || extra) throw new AuthError();

  const expected = createHmac('sha256', secret).update(body).digest('base64url');
  const given = Buffer.from(sig);
  const actual = Buffer.from(expected);
  if (given.length !== actual.length || !timingSafeEqual(given, actual)) throw new AuthError();

  let parsed: { userId?: unknown; exp?: unknown };
  try {
    parsed = JSON.parse(Buffer.from(body, 'base64url').toString()) as { userId?: unknown; exp?: unknown };
  } catch {
    throw new AuthError();
  }

  if (typeof parsed.userId !== 'string' || parsed.userId.length === 0) throw new AuthError();
  if (typeof parsed.exp !== 'number' || parsed.exp < now) throw new AuthError();
  return { userId: parsed.userId };
}
