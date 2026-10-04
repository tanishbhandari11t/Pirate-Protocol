# Backend specs for the next voyage features

For Person A (NestJS). Each feature below needs server authority: the server rolls, times, hides and
decides. The frontend only renders what it is pushed. Everything here plugs into the existing v3
protocol (`src/lib/socket/contract.ts`): requests are acked with `{ ok, data } | { ok: false, error }`,
and state still arrives through `room:state` and `game:event`.

Error codes already in the contract and reused below: `INVALID_PAYLOAD`, `NOT_IN_ROOM`,
`NOT_SAILING`, `VOYAGE_OVER`, `ELIMINATED`, `RATE_LIMITED`, `NOT_ALLOWED`, `NOT_FOUND`,
`BAD_RECIPIENT`, `CANNOT_AFFORD`.

Until a feature ships, the Nest adapter answers its requests with `UNSUPPORTED`, and the matching
`CAPABILITIES` flag in `src/lib/socket/backend.ts` stays `false` so the UI never shows it.

---

## Already built in the mock (port these first)

### Chart marks (`CAPABILITIES.marks`)

Reference: `mock-server/marks.mjs`, tests in `src/test/multiplayer/marks.mp.test.ts`.

| Direction | Event | Payload | Ack |
| --- | --- | --- | --- |
| C → S | `map:mark` | `{ kind: "pin" \| "danger" \| "treasure" \| "route", points: {x,y}[] }` (0–100 grid) | `MapMark` |
| C → S | `map:unmark` | `{ markId }` | `null` |
| S → C | `map:marks` | `{ roomCode, marks: MapMark[] }` (full set, after every change and on rejoin) | |

Rules: only seated, non-eliminated sailors while the voyage is sailing (`NOT_ALLOWED` otherwise);
only the author may erase; limits live in `MARK_LIMITS` (`src/lib/socket/marks.ts`).

### Captain's Gambit (`CAPABILITIES.gambit`)

Reference: `mock-server/gambit.mjs`, tests in `src/test/multiplayer/gambit.mp.test.ts`.

| Direction | Event | Payload | Ack |
| --- | --- | --- | --- |
| C → S | `gambit:challenge` | `{ toPlayerId }` | `GambitDuel` |
| C → S | `gambit:respond` | `{ duelId, accept: boolean }` | `GambitDuel` |
| S → C | `gambit:update` | `GambitDuel`, to the two duellists only | |

Rules: rival must be seated in the same room; one live duel per sailor; 3 s cooldown per challenger;
30 s to answer, then `expired`; 3d6 per side per round, best of three (ties replay, 5 rounds max);
dice come from a CSPRNG. Stakes are honour only: no items move, so it never competes with trading.
On leave/kick, forfeit the sailor's duel.

---

## New features

### 1. Kraken Hunt

A crew-wide event where everyone must cooperate or the Kraken sinks a random island's route.

- Trigger: server timer, at most once per voyage, never in the last 3 minutes.
- `game:event` `KRAKEN_RISING { islandKey, endsAt, needed }`, where `needed` = number of distinct sailors
  who must answer.
- C → S `kraken:strike { answer }` → ack `{ hits, needed }`. Answers come from the island's own
  riddle pool and are checked server-side like `puzzle:submit`.
- Resolve: `KRAKEN_DEFEATED { by: PlayerId[] }` (each striker gets a `tide-rumor`) or
  `KRAKEN_FED { islandKey }` (that island's lane closes for 2 minutes; `map:move` there returns
  `NOT_ALLOWED`).
- UI ready: `VoyageMap` already renders a `kraken` sighting; it just needs the event wired up.

### 2. The Hourglass

A relic that buys time for the crew, not for one sailor.

- New item `hourglass` (granted for solving a hard island first). Not tradable.
- C → S `item:use { itemKey: "hourglass" }` → ack `{ endsAt }`. Server extends `endsAt` by 90 s,
  once per voyage per crew.
- `game:event` `TIME_TURNED { playerId, endsAt }`; `room:state.endsAt` updates as usual.

### 3. Disguise

Lets a sailor hide their position from rivals for a short while.

- Item `disguise`, single use. While active, `currentIslandKey` for that sailor is sent as `null`
  to **other** sockets in `room:state` (the owner still sees their own).
- `item:use { itemKey: "disguise" }` → ack `{ until }`; event `DISGUISED { playerId, until }` and
  `UNMASKED { playerId }`.
- The server must also strip the sailor from `MOVED` payloads sent to others while disguised.

### 4. Crew roles

Chosen in the lobby, enforced in play.

| Role | Perk (server-enforced) |
| --- | --- |
| Navigator | Sees one uncharted island's position at start (sent only to them). |
| Quartermaster | One extra free hint per voyage. |
| Gunner | First trap strike each voyage is forgiven. |
| Lookout | `ISLAND_DISCOVERED` reveals adjacent island names to them only. |

- C → S `player:role { role }` in the lobby only; unique per crew (`NOT_ALLOWED` if taken).
- Add `role: string | null` to the lobby `PlayerSnapshot` and `PublicPlayer`.

### 5. Black Market

A short-lived shop that only opens at night (see `lib/game/sky.ts`, where the sky has a clock).

- Server opens it on a schedule: `MARKET_OPEN { closesAt, wares: { itemKey, price }[] }`.
- Price is paid in strikes or rumours (same currencies as hints, so no new economy).
- C → S `market:buy { itemKey, payWith }` → ack `InventoryItem[]`. Stock is per crew and
  first come, first served (`NOT_FOUND` when sold out, `CANNOT_AFFORD` as hints do).

### 6. One Chest

An alternative win mode: a single chest, and whoever holds it when the tide runs out wins.

- New `VoyageSettings.mode: "vault" | "one-chest"` (articles in the lobby).
- Item `the-chest` exists once; it moves with `trade:item` and can be **stolen** by a sailor who
  solves a riddle on the holder's island (`CHEST_SEIZED { from, to }`).
- On time-out, `finishReason: "treasure"` with `winnerPlayerId` = holder.

### 7. Nemesis

Each sailor is secretly assigned one rival.

- At `game:started`, send each socket `nemesis:assigned { playerId }` (private, never broadcast).
- Beating your nemesis to an island's riddle awards +1 score; revealed in `game:finished` as
  `nemeses: Record<PlayerId, PlayerId>`.

### 8. Underground vaults

Hidden islands beneath the map.

- Islands gain `layer: 0 | 1`. Layer-1 islands are withheld from `room:state.islands` until a sailor
  solves the layer-0 island linked to them (`UNDERGROUND_OPENED { islandKey, by }`).
- `map:move` to a withheld island returns `ISLAND_HIDDEN` (already in the contract).

### 9. Living islands

Islands that change during the voyage.

- Server may mark an island `state: "calm" | "stormy" | "sunken"` and push `ISLAND_CHANGED { islandKey, state }`.
- Sunken islands refuse `map:move` (`NOT_ALLOWED`); stormy islands double the wrong-answer cooldown.
- The frontend already tints dangerous waters (`lib/game/danger.ts`), so it only needs the new field.

---

## Seven Seas Calendar (shared rotation)

The frontend derives one condition per UTC day from `src/lib/game/calendar.ts`
(`seaConditionFor(Date.now())`). It is pure and deterministic, so the server can import the same
file to apply rule changes on the same day:

| Condition | Frontend today | Suggested server effect |
| --- | --- | --- |
| Ghost Moon | Ghost ships of past crews on the chart | none needed |
| Golden Tide | Gold shimmer | +1 score for the first solve of each island |
| Bloodstorm | Crimson sky | Trap riddles fire on the first wrong answer |
| Silent Waters | Quiet narrator | Chat limited to quick calls |
| Fair Winds | Clear skies | none |

If the server adopts it, add `seaCondition: SeaConditionId` to `room:state` so every client agrees
even across a midnight boundary.
