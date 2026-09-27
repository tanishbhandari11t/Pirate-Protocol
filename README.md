<<<<<<< HEAD
# Pirate Protocol

Pirate Protocol is the authoritative server for a multiplayer treasure hunt. Sailors sign in as guests, form a crew of up to six, sail a shared map of eight islands, solve puzzles, trade a few scraps, and try to open The Vault before a trap takes them out of the hunt.

Clients send intents. The server decides what happened, writes it to PostgreSQL, and tells every connected sailor the new room state. A client never grades an answer, never invents an item, and never learns the solution. Puzzle rows store a peppered SHA-256 hash. Public room payloads carry the prompt and a cipher label, and they stop there.

This repository is the API and the realtime gateway. It does not ship a game client. The HTTP routes and the Socket.IO events below are the contract a client implements.

## Contents

1. [How a hunt plays](#how-a-hunt-plays)
2. [Rules the server enforces](#rules-the-server-enforces)
3. [Stack](#stack)
4. [Repository layout](#repository-layout)
5. [Requirements](#requirements)
6. [Local setup](#local-setup)
7. [Environment](#environment)
8. [npm scripts](#npm-scripts)
9. [Authentication](#authentication)
10. [HTTP API](#http-api)
11. [Room state](#room-state)
12. [WebSocket](#websocket)
13. [Game events](#game-events)
14. [The demo world](#the-demo-world)
15. [Items](#items)
16. [Data model](#data-model)
17. [How an intent is applied](#how-an-intent-is-applied)
18. [Errors](#errors)
19. [Tests](#tests)
20. [Building a client](#building-a-client)
21. [Operating this build](#operating-this-build)
22. [Changing the world](#changing-the-world)

## How a hunt plays

A sailor picks a username and receives a bearer token. The same username always resolves to the same user row, so a refresh is a new token for the same sailor.

The host creates a crew. The server allocates a six-character room code, names the room `Crew AB23CD` unless the host sent a name, seats the host on Port Royal, and writes `PLAYER_JOINED`. The room starts in `LOBBY`.

Other sailors join with that code. They also start on Port Royal. A sailor who is already `ACTIVE` in another crew is refused until they leave it. A sailor who left this crew and comes back is restored to `ACTIVE`. Their inventory, strikes, and island are kept. A finished hunt rejects new joins.

Movement is a teleport. Any island key on the shared map is a legal destination. The first move, or the first solved puzzle, flips the room from `LOBBY` to `ACTIVE`.

Each island has one puzzle in the seed. The sailor submits a string. The server trims it, lowercases it, collapses whitespace, hashes it with `APP_SECRET`, and compares the digest to `answerHash`. A match grants the island's relic (when it has one), records `PUZZLE_SOLVED`, and records that sailor's progress. A mismatch on a normal island records `PUZZLE_FAILED` and leaves the puzzle open. A mismatch on a trap island records `TRAP_TRIGGERED`, adds a strike, and drops a cursed coin into that sailor's inventory.

Three strikes set `isEliminated`. An eliminated sailor stays on the crew list and can still be seen, but move, answer, and trade are refused.

Five relics open the door to grading The Vault: compass, spyglass, serpent-key, widow-chart, and gold-seal. The vault check runs before the answer is hashed. Missing relics return an error and do not spend a guess. With the relics in that sailor's own inventory, the correct vault phrase grants the treasure chest, writes `TREASURE_FOUND`, and sets the room to `FINISHED`. That sailor's player id is `winnerPlayerId`. Later answers in that room are refused.

`tide-rumor` and `cursed-coin` can be handed to another active sailor in the same crew, one unit per offer. Relics and the chest cannot.

## Rules the server enforces

| Rule | What the code does |
| --- | --- |
| One crew at a time | Creating or joining while `ACTIVE` elsewhere returns 409 and names the other code. |
| Crew size | `maxPlayers` is 6. The seventh active sailor is refused. |
| Room code | Six characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`. `I`, `O`, `0`, and `1` are omitted so codes can be read aloud. Input is trimmed and uppercased. |
| Identity | Usernames are 3–16 characters, `a-z`, `0-9`, `_`, stored lowercase. |
| Guest trust | Whoever can post a username receives a token for that sailor. |
| Token life | HMAC-SHA-256 payload, valid for seven days. There is no refresh route. Sign in again. |
| Presence | `isOnline` and `lastSeenAt` live on the player row. The last Socket.IO disconnect for that user marks every active crew of theirs offline. Disconnect does not remove them from the crew. |
| Secrets | `answerHash` is never copied onto the public puzzle shape. Failed guesses are logged as events. The submitted string is not stored in the payload. |
| Already solved | A second correct submit for the same sailor and puzzle key is 409. |
| Vault gate | Treasure islands call `assertReady` on that sailor's item keys before grading. |
| First chest wins | The first accepted vault answer sets `FINISHED`. The room stays that way. |
| Elimination | `strikes` increments only when `trapOnFail` is true and the answer is wrong. At 3 the sailor is eliminated. |
| Trade | Only `tide-rumor` and `cursed-coin`. The recipient must be `ACTIVE` in the same room. Trading with yourself is refused. |
| Shared catalog | Islands and puzzles are global rows, not copied per room. Every crew sees the same map. Progress and inventory are per sailor. |

## Stack

| Piece | Role |
| --- | --- |
| Node.js 20+ | Runtime. `engines` in `package.json` requires it. |
| NestJS 11 | HTTP controllers, guards, validation, and the Socket.IO gateway. |
| PostgreSQL 16 | Source of truth for users, crews, catalog, inventory, and the event log. |
| Prisma 6 | Schema, client, and seed. |
| Socket.IO 4 | Crew channel `room:<CODE>`. |
| class-validator | Request bodies. Unknown fields are rejected. |

Presence is a boolean on `Player`. The in-process `RealtimeBus` fans HTTP and socket mutations out to sockets on this process. A second API process would not see those socket rooms or that bus. Add a shared adapter when you run more than one process. Until then, run one API.

CORS is open on HTTP (`enableCors()` with defaults) and on the gateway (`origin: true`). Tighten both before any public host.

## Repository layout

```
prisma/schema.prisma     PostgreSQL models
prisma/seed.ts           Eight islands, eight puzzles, hashed answers
src/main.ts               Bootstrap, CORS, validation pipe, exception filter
src/app.module.ts         Module graph
src/auth/                 Guest login, HMAC tokens, bearer guard
src/rooms/                Create, join, leave, presence, room snapshots
src/players/              Online flag and disconnect sweep
src/game/engine/          Move, answer, trade transactions
src/game/map/             Island lookup
src/game/puzzles/         Grade and "already solved"
src/game/inventory/       Catalog and grant/transfer
src/game/trading/         Tradable-item check
src/game/traps/           Strike counter
src/game/treasure/        Required relics
src/websocket/            Gateway, event names, in-process bus
src/common/               Env validation, event types, error text
src/health.controller.ts  Database ping
docker-compose.yml        Postgres on host port 5433
```

There is no `prisma/migrations` directory in this repo. The schema file is the migration until you generate one. Setup below uses `prisma db push` for that reason.

## Requirements

- Node.js 20 or newer, and npm
- Docker, if you want the compose Postgres. Any Postgres 16 you can reach with `DATABASE_URL` also works.
- A free local port. The API defaults to `3000`. Compose publishes Postgres on **5433** so it does not collide with a Postgres already bound to 5432.

## Local setup

1. Start Postgres and wait until the healthcheck is healthy.

```bash
docker compose up -d
docker compose ps
```

2. Create the env file.

Windows Command Prompt or PowerShell:

```powershell
copy .env.example .env
```

macOS or Linux:

```bash
cp .env.example .env
```

Change `APP_SECRET` before anyone else uses the server. The seed hashes every answer with that secret. If you change it after seeding, run the seed again or every puzzle will grade false. Existing tokens also stop verifying, because they were signed with the old secret.

3. Install dependencies. `postinstall` runs `prisma generate`.

```bash
npm install
```

4. Create tables from `prisma/schema.prisma`, then load the world.

```bash
npx prisma db push
npx prisma db seed
```

`db push` is the right first step because this repo does not yet contain a migrations folder. `npx prisma migrate deploy` has nothing to apply until you create that history. When you want a committed migration for a shared database, generate it once:

```bash
npx prisma migrate dev --name init
```

Commit `prisma/migrations`, and use `npm run db:deploy` on later machines.

5. Start the API.

```bash
npm run start:dev
```

The process logs `Pirate Protocol listening on 3000`. Confirm the database with:

```bash
curl.exe http://localhost:3000/health
```

A healthy process returns `{ "ok": true }`. If Postgres is down, this route fails and the process logs the real error. The HTTP body for unexpected failures is `{ "statusCode": 500, "message": "Internal server error" }`.

## Environment

`.env.example`:

```
DATABASE_URL=postgresql://pirate:pirate@localhost:5433/pirate_protocol
APP_SECRET=hackathon-only-change-me
PORT=3000
```

`src/common/env.ts` rejects boot unless all three hold:

| Variable | Constraint |
| --- | --- |
| `DATABASE_URL` | Must start with `postgresql://`. |
| `APP_SECRET` | At least 16 characters. Used as the HMAC key for tokens and as the pepper in `sha256(pepper + ":" + normalizedAnswer)`. |
| `PORT` | Integer from 1 to 65535. Omitted or empty becomes 3000. |

Compose credentials match that URL: user `pirate`, password `pirate`, database `pirate_protocol`, container port 5432, host port 5433. The volume `pirate_pg` keeps data across `docker compose down`. `docker compose down -v` deletes it. After a volume wipe, run `db push` and the seed again.

Do not commit `.env`. It is gitignored.

## npm scripts

| Script | What it runs |
| --- | --- |
| `npm run start:dev` | `nest start --watch` |
| `npm start` | `nest start` |
| `npm run build` | `nest build` into `dist/` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Jest, in band, ignoring `*.smoke.spec.ts` |
| `npm run test:smoke` | Boots the real API against `DATABASE_URL` |
| `npm run prisma:generate` | Regenerate the Prisma client |
| `npm run prisma:validate` | Validate `schema.prisma` |
| `npm run prisma:migrate` | `prisma migrate dev` (interactive; needs a migrations workflow) |
| `npm run db:deploy` | `prisma migrate deploy` |
| `npm run db:seed` | `tsx prisma/seed.ts` |

`npm run test:smoke` sets `SMOKE=1` with Windows `cmd` syntax (`set SMOKE=1&&`). npm on Windows runs scripts through `cmd.exe`, so `npm run test:smoke` is the command to use. The smoke test needs Postgres, a pushed schema, and a seed. It creates two guest users, a crew, joins, toggles presence, leaves, moves, and submits a wrong answer, and it asserts the JSON never contains `answerHash`.

Unit tests in `src/game/engine/rules.spec.ts` do not touch the database. They cover answer normalization, relic names, the third strike, room-code alphabet, token expiry, the public puzzle shape, and socket code parsing.

## Authentication

`POST /auth/guest` is public. Every other HTTP route expects:

```
Authorization: Bearer <token>
```

Socket.IO accepts the same token in either place:

- handshake `auth.token`
- handshake header `Authorization: Bearer <token>`

A bad or missing socket token emits `game:error` and disconnects.

The token is not issued by a session table. `signToken` builds base64url JSON `{ "userId", "exp" }`, appends a dot, and appends base64url HMAC-SHA-256 of that body using `APP_SECRET`. Verification checks the signature with `timingSafeEqual`, then checks `exp` against the current time. Lifetime is seven days from issue.

Guest request:

```http
POST /auth/guest
Content-Type: application/json

{ "username": "Anne" }
```

`Anne` is stored as `anne`. The response:

```json
{
  "token": "<body>.<sig>",
  "expiresAt": "2026-10-04T12:00:00.000Z",
  "user": { "id": "clxxxxxxxx", "username": "anne" }
}
```

Usernames that fail `^[a-z0-9_]{3,16}$` after trim and lowercase return 400. Examples that fail: `no`, `has space`, `way_too_long_name_here`.

Call guest again with the same username to mint a new token for the same `user.id`. Previous tokens stay valid until they expire or `APP_SECRET` changes.

## HTTP API

Validation uses a global `ValidationPipe` with `whitelist`, `forbidNonWhitelisted`, and `transform`. An extra JSON field is a 400. Room codes in the path go through `RoomCodePipe` and must match the six-character alphabet.

| Method | Path | Auth | Success | Body |
| --- | --- | --- | --- | --- |
| `GET` | `/health` | No | 200 `{ "ok": true }` | — |
| `POST` | `/auth/guest` | No | 200 session | `{ "username": "anne" }` |
| `POST` | `/rooms` | Yes | 201 room state | `{ "name": "optional" }` name max 40 |
| `POST` | `/rooms/join` | Yes | 200 room state | `{ "code": "AB23CD" }` |
| `POST` | `/rooms/:code/leave` | Yes | 200 `{ "left": true }` | — |
| `GET` | `/rooms/:code` | Yes | 200 room state | — |
| `POST` | `/rooms/:code/presence` | Yes | 200 presence | `{ "online": true }` |
| `POST` | `/rooms/:code/move` | Yes | 200 room state | `{ "islandKey": "port-royal" }` |
| `POST` | `/rooms/:code/answer` | Yes | 200 room state | `{ "puzzleKey": "port-royal-map", "answer": "map" }` |
| `POST` | `/rooms/:code/trade` | Yes | 200 room state | `{ "toPlayerId": "<player id>", "itemKey": "tide-rumor" }` |

`islandKey`, `puzzleKey`, and `itemKey` must match `^[a-z0-9-]{3,40}$`. Answers are 1–80 characters. `toPlayerId` is 8–40 characters.

Create, join, move, answer, and trade return the caller's room state (the shape in the next section). Leave returns only `{ "left": true }` after the server has already published the departure to sockets in that crew. Presence returns:

## WebSocket

Connect to the same origin with Socket.IO. Pass the token as `auth.token` or `Authorization: Bearer`.

Client events:

- `room:create` `{ name? }`
- `room:join` `{ code }`
- `room:leave` `{ code }`
- `presence:update` `{ code, online }`
- `map:move` `{ code, islandKey }`
- `puzzle:submit` `{ code, puzzleKey, answer }`
- `trade:offer` `{ code, toPlayerId, itemKey }`

Server events:

- `room:state` full state, with `you` scoped to that socket
- `presence:changed` `{ code, playerId, userId, online, lastSeenAt }`
- `game:event` one new log entry
- `game:error` `{ message }`

Disconnect marks the sailor offline. It does not remove them from the crew.

## Demo world

Eight islands. Relics required at The Vault: compass, spyglass, serpent-key, widow-chart, gold-seal.

| Island | Puzzle key | Answer | Reward |
| --- | --- | --- | --- |
| Port Royal | `port-royal-map` | `map` | compass |
| Blackreef | `blackreef-cipher` | `treasure` | spyglass |
| Serpent Cay | `serpent-anagram` | `serpent` | serpent-key |
| Deadman's Shelf | `deadman-plaque` | `leave` | trap on any other answer |
| Widow's Rock | `widow-riddle` | `silence` | widow-chart |
| Kraken Shoal | `kraken-arms` | `0` | tide-rumor, trap otherwise |
| Goldmouth | `goldmouth-tides` | `four` | gold-seal |
| The Vault | `vault-protocol` | `pirate protocol` | treasure chest, hunt ends |

`tide-rumor` and `cursed-coin` can be traded. Relics cannot.

## Layout

`src/auth`, `src/rooms`, `src/players`, `src/game` (`engine`, `map`, `puzzles`, `inventory`, `trading`, `traps`, `treasure`), `src/websocket`, `src/prisma`, `src/common`. The Prisma schema lives in `prisma/` so the Prisma CLI can find it.
=======
# ☠️ Pirate Protocol — Frontend

> *"An ancient pirate map came alive."*

Gather yer crew, decipher the living map, and outwit rival pirates for the buried hoard.
This be the frontend: every wave, every lantern flicker, every scrap of parchment you see on screen.

Built with **Next.js 16 · TypeScript · Tailwind CSS v4 · Framer Motion · Socket.IO**.
No image files were harmed in the making of this ship — every pirate, galleon, wave and compass is hand-drawn SVG in code.

---

## 🧭 The Voyage So Far

| Phase | What's aboard | Status |
| --- | --- | --- |
| **Phase I — The Harbour** | Landing, Create Crew, Join Crew, Waiting Room, design system, typed socket layer | ⚓ Moored & ready |
| **Phase II — The Map Awakens** | The living treasure map and the actual game | 🌫️ Somewhere past the fog |

### What Phase I gives you

- **The Harbour** (`/`) — moonlit ocean, drifting fog, a galleon on the horizon, and one big brass button: *Enter the Waters*.
- **Raise Your Colours** (`/crew/create`) — pick a pirate name, one of 8 hand-drawn likenesses, and christen your ship.
- **Board a Ship** (`/crew/join`) — punch in the 6-rune room code (or open an invite link) and climb aboard.
- **The Crew Manifest** (`/lobby/[code]`) — see who's aboard, who's ready, copy the code, and — if you wear the captain's hat — set sail.
- **The Shipwright's Almanac** (`/design`) — the full design system on display: buttons, parchment, panels, modals, tooltips, toasts and loaders.

It works on anything from a phone to a widescreen monitor, and respects *reduced motion* for landlubbers with queasy stomachs.

---

## 🏴‍☠️ Setting Sail (Quick Start)

You'll need **Node.js 20+**.

```bash
cd frontend
npm install
cp .env.example .env.local     # on Windows PowerShell: copy .env.example .env.local
```

Now open two terminals — one for the sea, one for the ship:

```bash
# Terminal 1 — a practice harbour (fake lobby server on :4000)
npm run mock:server

# Terminal 2 — the ship itself
npm run dev
```

Sail to **http://localhost:3000**. Open a second browser window, join with the room code, and you've got yourself a crew.

> 🦜 The mock server only handles the lobby. It does **not** fake any game logic — that's the real backend's job.

---

## 📜 Ship's Orders (Scripts)

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server with hot reload |
| `npm run build` | Build for production |
| `npm run start` | Run the production build |
| `npm run lint` | Have the quartermaster inspect the code (ESLint) |
| `npm run typecheck` | Make sure the types hold water (`tsc --noEmit`) |
| `npm run mock:server` | Run the practice lobby server on port 4000 |

---

## ⚙️ Environment

| Variable | Default | Meaning |
| --- | --- | --- |
| `NEXT_PUBLIC_SOCKET_URL` | `http://localhost:4000` | Where the Socket.IO backend lives |

---

## 🔌 Talking to the Backend

All messages between ship and shore are defined in one place:
**`src/lib/socket/contract.ts`** — the treaty both sides must honour.

Every request from the client gets an acknowledgement shaped like:

```ts
{ ok: true, data: T } | { ok: false, error: { code, message } }
```

### Client → Server (requests)

| Event | Sends | Gets back |
| --- | --- | --- |
| `crew:create` | player name, avatar, crew name | seat grant (room + player id + session token) |
| `crew:join` | player name, avatar, room code | seat grant |
| `crew:rejoin` | room code, session token | seat grant |
| `crew:leave` | — | `null` |
| `player:ready` | `{ ready }` | updated player |
| `game:start` | — | `null` (captain only) |

### Server → Client (broadcasts)

| Event | When it fires |
| --- | --- |
| `room:state` | Full room snapshot |
| `room:player-joined` | A new sailor comes aboard |
| `room:player-left` | Someone left, disconnected, or walked the plank |
| `room:player-updated` | A sailor changed (e.g. ready state) |
| `room:captain-changed` | The hat changed heads |
| `game:starting` | Countdown begins |
| `game:started` | Anchors aweigh — off to `/voyage/[code]` |
| `server:notice` | A message from the harbour master (shown as a toast) |

Refresh the page or lose your connection? The client quietly **rejoins** using the session token saved in the tab.

---

## 🗺️ Map of the Hold (Project Structure)

```
frontend/
├── mock-server/lobby.mjs        practice lobby server (no game logic)
└── src/
    ├── app/                     pages: harbour, crew/create, crew/join, lobby, voyage, design
    ├── components/
    │   ├── atmosphere/          sky, galleon, ocean, fog, floating embers
    │   ├── avatar/              the 8 pirates, porthole frame, avatar picker
    │   ├── brand/               logo, emblem, compass rose
    │   ├── crew/                create/join form shell, identity preview, crew flag
    │   ├── lobby/               room code plaque, crew cards, ship's log, captain's orders, countdown
    │   ├── layout/              top bar, connection lantern
    │   ├── map/                 treasure map sketch
    │   ├── ui/                  the design system (buttons, parchment, panels, modal, tooltip, toasts…)
    │   └── icons.tsx            20 nautical icons
    └── lib/
        ├── socket/              typed contract, client, hooks, error messages
        ├── crew/                crew state (reducer + provider)
        ├── avatars.ts           what each pirate looks like
        └── validation.ts        name & room-code rules
```

### Want to change how a pirate looks?

Edit **`src/lib/avatars.ts`** — skin, hat, hair, beard, eyepatch, earring. The drawing itself lives in `src/components/avatar/PirateAvatar.tsx`.

---

## 🎨 The Look

| Ingredient | Where it comes from |
| --- | --- |
| Deep ocean blues | `abyss`, `deep`, `sea`, `tide` |
| Aged parchment | `parchment`, `ink` |
| Brass & gold | `brass`, `gold` |
| Headlines | *Pirata One* |
| Body text | *IM Fell English* |
| Labels & buttons | *Cinzel* |

All colours, fonts and animations live in `src/app/globals.css`.

---

<p align="center"><i>Dead men tell no tales — but good READMEs do.</i> 🦜</p>
>>>>>>> 8bd44cbb8141b265aef4b568828f846fadd7246d
