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
