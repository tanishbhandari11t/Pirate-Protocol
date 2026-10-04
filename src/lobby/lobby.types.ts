export type ClientErrorCode =
  | 'INVALID_PAYLOAD'
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'GAME_IN_PROGRESS'
  | 'NAME_TAKEN'
  | 'NOT_CAPTAIN'
  | 'NOT_READY'
  | 'UNAUTHORIZED';

export type AckOk<T> = { ok: true; data: T };
export type AckFail = { ok: false; error: { code: ClientErrorCode; message: string } };
export type Ack<T> = AckOk<T> | AckFail;

export function ackOk<T>(data: T): AckOk<T> {
  return { ok: true, data };
}

export function ackFail(code: ClientErrorCode, message?: string): AckFail {
  return { ok: false, error: { code, message: message ?? code } };
}
