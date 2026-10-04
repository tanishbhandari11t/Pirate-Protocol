# Pirate Protocol

Authoritative NestJS server for a multiplayer treasure hunt. Clients send intents; the server grades answers, updates Postgres, and broadcasts `room:state` / `game:event`. Puzzle solutions never leave the server (`answerHash` is never public).

There is **no game UI in this repo**. Clients implement the HTTP + Socket.IO contract below. Shared types live in [`src/contract/socket-contract.ts`](src/contract/socket-contract.ts).

## Quick start

```bash
docker compose up -d
copy .env.example .env          # or: cp .env.example .env
npm install
npx prisma db push
npm run db:seed
npm run start:dev
```

Health: `GET http://localhost:3000/health` → `{ "ok": true }`  
Default API port **3000**. Compose Postgres on host **5433**.

Change `APP_SECRET` before sharing the server, then **re-seed** (answers are hashed with it). **Restart the API after reseed** so the in-memory island/puzzle catalog cache reloads.

| Script | Purpose |
| --- | --- |
| `npm run start:dev` | Watch mode |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit tests (no DB) |
| `npm run test:smoke` | Integration against Postgres |
| `npm run db:seed` | Seed islands + puzzles |
| `npm run build` | Nest build → `dist/` |

## How a hunt plays

1. Guest auth → bearer token.
2. Host creates a crew (`LOBBY`). Others join with a 6-char code.
3. ≥2 sailors mark **ready**. Captain starts voyage → 3s `COUNTDOWN` → `ACTIVE` (`game:starting` / `game:started`).
4. Move only along **charted routes** (`destinations` on your snapshot). Explore / solve / trade.
5. Collect five relics → The Vault → first correct `pirate protocol` → `FINISHED`.

Move, answer, trade, and explore are refused until status is `ACTIVE`. Three trap strikes eliminate a sailor.

## Auth

`POST /auth/guest` `{ "username": "anne" }` → `{ token, expiresAt, user }`.  
Username: 3–16 chars, `a-z0-9_`, stored lowercase.

HTTP: `Authorization: Bearer <token>`  
Socket: `auth: { token }` or the same Bearer header. Lobby `crew:create` / `crew:join` can mint a guest for you and return `token` + `userId` in the ack.

## HTTP API

| Method | Path | Body / notes |
| --- | --- | --- |
| `GET` | `/health` | Public |
| `POST` | `/auth/guest` | `{ username }` |
| `POST` | `/rooms` | `{ name? }` → 201 voyage snapshot |
| `POST` | `/rooms/join` | `{ code }` |
| `GET` | `/rooms/:code` | Members only |
| `POST` | `/rooms/:code/leave` | `{ left: true }` |
| `POST` | `/rooms/:code/presence` | `{ online }` |
| `POST` | `/rooms/:code/ready` | `{ ready: boolean }` lobby ack shape |
| `POST` | `/rooms/:code/voyage/start` | Captain only; starts countdown |
| `POST` | `/rooms/:code/move` | `{ islandKey }` |
| `POST` | `/rooms/:code/explore` | `{ islandKey }` must be current island |
| `POST` | `/rooms/:code/answer` | `{ puzzleKey, answer }` |
| `POST` | `/rooms/:code/trade` | `{ toPlayerId, itemKey }` |

Mutations return voyage `room:state` (except leave / presence / ready / start). Ready & start return lobby-style `{ ok, data }` / `{ ok, error }` when called via lobby service paths; HTTP ready/start use the lobby service acks.

## Room state (voyage)

`room:state` and most HTTP responses share this shape. `you`, `vault`, and `destinations` are **per viewer**.

| Field | Meaning |
| --- | --- |
| `status` | `LOBBY` \| `COUNTDOWN` \| `ACTIVE` \| `FINISHED` |
| `phase` | `lobby` \| `countdown` \| `voyage` \| `finished` |
| `countdownEndsAt` / `voyageStartedAt` | ISO or null |
| `players` | Active seats (displayName, avatarId, ready, island, strikes, …) |
| `islands` | Public catalog (prompts, **no** `answerHash`) |
| `discoveredIslandKeys` / `exploredIslandKeys` | Fog / explore progress |
| `activeClues` | `{ id, text, islandKey? }[]` — no answers |
| `scores` | `{ playerId, points }[]` derived from events |
| `destinations` | Legal next `islandKey`s from **your** island |
| `vault` | `{ ready, missingRelics }` for **you** only |
| `progress` | All `PUZZLE_SOLVED` in the room |
| `log` | Newest 40 events, oldest-first |
| `you` | Your inventory |
| `winnerPlayerId` | Set after vault win |

Lobby socket snapshots use a smaller shape (`crewName`, `captainId`, `phase: lobby|countdown|in-game|finished`, …) — see `LobbyRoomSnapshot` in the contract file.

## WebSocket

URL: `http://localhost:3000` (path `/socket.io`). Channel: `room:<CODE>`.

### Lobby (`crew:*`) — ack `{ ok: true, data }` \| `{ ok: false, error: { code, message } }`

| Client | Notes |
| --- | --- |
| `crew:create` | `{ playerName, crewName, avatarId }` → token + lobby room |
| `crew:join` | `{ playerName, roomCode, avatarId }` |
| `crew:ready` | `{ roomCode\|code, ready }` |
| `crew:start` | Captain only |
| `crew:leave` | Leave crew |

Avatar ids: `captain`, `corsair`, `navigator`, `gunner`, `sea-witch`, `quartermaster`, `old-salt`, `powder-monkey`.

Error codes: `INVALID_PAYLOAD`, `ROOM_NOT_FOUND`, `ROOM_FULL`, `GAME_IN_PROGRESS`, `NOT_CAPTAIN`, `NOT_READY`, …

Lobby emits: `room:state` (lobby snapshot), `game:starting`, `game:started`, `server:notice`.

### Voyage (token required)

| Client | Payload |
| --- | --- |
| `room:create` / `room:join` / `room:leave` | Same as HTTP create/join/leave |
| `presence:update` | `{ code, online }` |
| `map:move` | `{ code, islandKey }` |
| `island:explore` | `{ code, islandKey }` |
| `puzzle:submit` | `{ code, puzzleKey, answer }` |
| `trade:offer` | `{ code, toPlayerId, itemKey }` |

Canonical server events: `room:state`, `game:event`, `presence:changed`, `game:error`, `server:notice`, `game:starting`, `game:started`, `game:finished`.

Thin aliases (also emitted): `puzzle:solved`, `puzzle:failed`, `trap:triggered`, `inventory:updated`, `trade:accepted`, `island:discovered`, `map:updated`, … Prefer mapping `game:event.type` if you only want one stream.

## Map routes

Illegal hops → HTTP 400 `That route is not on your chart`.

```
port-royal → blackreef, serpent-cay
blackreef → port-royal, deadmans-shelf, widows-rock
serpent-cay → port-royal, kraken-shoal
deadmans-shelf → blackreef, widows-rock
widows-rock → blackreef, deadmans-shelf, goldmouth
kraken-shoal → serpent-cay, goldmouth
goldmouth → widows-rock, kraken-shoal, the-vault
the-vault → goldmouth
```

Graph: `src/game/map/routes.ts`.

## Game event types

| Type | When |
| --- | --- |
| `PLAYER_JOINED` / `PLAYER_LEFT` | Seat changes |
| `VOYAGE_STARTED` | Countdown finished |
| `MOVED` | Legal travel |
| `ISLAND_DISCOVERED` / `ISLAND_EXPLORED` / `CLUE_FOUND` / `ADVENTURE_NOTICE` | Explore / first visit |
| `PUZZLE_SOLVED` / `PUZZLE_FAILED` / `TRAP_TRIGGERED` | Grading |
| `ITEM_GRANTED` / `TRADED` | Inventory |
| `TREASURE_FOUND` | Vault win → `FINISHED` |

## Demo answers (dev only)

Do **not** ship these in a player client.

| Puzzle key | Answer |
| --- | --- |
| `port-royal-map` | `map` → compass |
| `blackreef-cipher` | `treasure` → spyglass |
| `serpent-anagram` | `serpent` → serpent-key |
| `deadman-plaque` | `leave` (else strike) |
| `widow-riddle` | `silence` → widow-chart |
| `kraken-arms` | `0` → tide-rumor (else strike) |
| `goldmouth-tides` | `four` → gold-seal |
| `vault-protocol` | `pirate protocol` → chest |

Vault needs all five relics on **one** sailor: compass, spyglass, serpent-key, widow-chart, gold-seal. Tradable only: `tide-rumor`, `cursed-coin`.

## Layout

```
prisma/schema.prisma      Models (+ COUNTDOWN, ready, avatar, …)
prisma/seed.ts            World + hashed answers
src/auth/                 Guest tokens
src/lobby/                crew:* ready / captain / countdown
src/rooms/                Crew HTTP + room-state snapshots
src/game/engine/          Move, explore, answer, trade
src/game/map/             Adjacency + start-island cache
src/game/score.ts         Score rules
src/contract/             Socket contract for clients
src/websocket/            Gateway + RealtimeBus
docker-compose.yml        Postgres :5433
```

## Rules (short)

- One active crew per user; max 6 sailors; unambiguous room-code alphabet.
- Host = captain for `crew:start` / voyage start.
- Charted travel only; same-island move is a no-op.
- Vault gate before hashing; first chest wins; eliminated sailors blocked.
- Single Node process: in-process bus + caches. No Redis. Scale-out needs a shared adapter.

## Tests

```bash
npm test                 # rules, adjacency, scores, tokens
npm run test:smoke       # needs Docker + push + seed
```

- `src/game/engine/rules.spec.ts` — unit  
- `src/rooms/crew.smoke.spec.ts` — ready → start → move → wrong answer  
- `src/rooms/adventure.smoke.spec.ts` — full two-player adventure path  

## Client integration checklist

1. Copy or import [`src/contract/socket-contract.ts`](src/contract/socket-contract.ts).
2. Lobby: `crew:create` / `crew:join` → store token → listen for `game:started`.
3. Voyage: `map:move`, `island:explore`, `puzzle:submit`, `trade:offer`.
4. Treat `room:state` as source of truth; use `destinations` for the map UI.
5. Never trust the client with answers; never expect `answerHash` in JSON.

## Known limits

- One API process (RealtimeBus + catalog / puzzle caches are in-memory).
- Restart after `db:seed` if the process was already running.
- Guest usernames are not passwords — anyone who knows a name can mint a token.
- Demo answers are in this README for hackathon speed.
