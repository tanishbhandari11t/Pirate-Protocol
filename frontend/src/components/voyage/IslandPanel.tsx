"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { VAULT_KEY, findPlayer, heldRelics, sailorsAt } from "@/lib/game/selectors";
import { ISLAND_RELIC, cipherInfo, itemInfo } from "@/lib/game/world";
import { REQUIRED_RELICS, type PublicIsland, type PublicPlayer, type RoomState } from "@/lib/socket/contract";
import { PirateAvatar } from "../avatar/PirateAvatar";
import { CloseIcon, CompassIcon, ScrollIcon, ShipIcon, WarningIcon } from "../icons";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Ornaments";
import { ItemGlyph } from "./ItemGlyph";

interface IslandPanelProps {
  room: RoomState;
  me: PublicPlayer;
  island: PublicIsland;
  charted: boolean;
  vaultOpen: boolean;
  busy: boolean;
  onSail: () => void;
  onInvestigate: () => void;
  onClose: () => void;
}

export function IslandPanel({ room, me, island, charted, vaultOpen, busy, onSail, onInvestigate, onClose }: IslandPanelProps) {
  const isVault = island.key === VAULT_KEY;
  const here = me.currentIslandKey === island.key;
  const puzzle = island.puzzles[0];
  const solvers = puzzle ? room.progress.filter((p) => p.puzzleKey === puzzle.key).map((p) => findPlayer(room, p.playerId)) : [];
  const solvedByMe = !!puzzle && room.progress.some((p) => p.puzzleKey === puzzle.key && p.playerId === me.id);
  const sailors = sailorsAt(room, island.key);
  const relic = ISLAND_RELIC[island.key];
  const held = heldRelics(room);
  const missing = REQUIRED_RELICS.filter((r) => !held.includes(r));
  const finished = room.status === "FINISHED";
  const known = isVault ? vaultOpen : charted;
  const blocked = me.isEliminated || finished;

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
      className="wood-panel relative w-full rounded-md p-4 sm:p-5"
      aria-label={known ? island.name : "Uncharted island"}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-2 top-2 rounded p-1.5 text-parchment/50 transition hover:text-parchment focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brass"
        aria-label="Close island details"
      >
        <CloseIcon size={16} />
      </button>

      <div className="flex flex-wrap items-center gap-2 pr-8">
        <p className="font-ui text-[0.6rem] uppercase tracking-[0.35em] text-brass/80">
          {here ? "Anchored here" : isVault ? "The end of the map" : known ? "Charted waters" : "Beyond the fog"}
        </p>
        {known && island.kind === "TRAP" && (
          <Badge tone="blood">
            <WarningIcon size={11} /> Treacherous
          </Badge>
        )}
        {solvedByMe && <Badge tone="kelp">Solved</Badge>}
      </div>
      <h3 className="mt-1 font-display text-3xl leading-none text-gilded sm:text-4xl">
        {known ? island.name : isVault ? "A Light in the Fog" : "Uncharted Island"}
      </h3>
      <p className="mt-2 font-body text-base italic leading-snug text-parchment/75 sm:text-lg">
        {known
          ? island.description
          : isVault
            ? "Something waits beyond the fog. Five relics may part it."
            : "Fog hides this shore. Only one way to learn what it holds."}
      </p>

      {here && puzzle && !solvedByMe && known && (
        <div className="mt-3 rounded border border-brass/25 bg-abyss/50 px-3 py-2.5">
          <p className="flex items-center gap-2 font-ui text-[0.58rem] uppercase tracking-[0.3em] text-brass/70">
            <ScrollIcon size={12} /> Active clue · {cipherInfo(puzzle.cipher).title}
          </p>
          <p className="mt-1 line-clamp-3 font-body text-[1.02rem] leading-snug text-parchment">“{puzzle.prompt}”</p>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 font-body text-sm text-parchment/60">
        {sailors.length > 0 && (
          <span className="flex items-center gap-2">
            <span className="flex -space-x-2">
              {sailors.slice(0, 4).map((s) => (
                <span key={s.id} className="h-7 w-7 overflow-hidden rounded-full border border-brass/60 bg-abyss">
                  <PirateAvatar avatarId={s.avatarId} outfit={s.outfit} faded={!s.isOnline} className="h-full w-full" />
                </span>
              ))}
            </span>
            {sailors.map((s) => (s.id === me.id ? "you" : s.username)).join(", ")}
          </span>
        )}
        {known && solvers.length > 0 && (
          <span>
            Cracked by {solvers.map((s) => (s?.id === me.id ? "you" : s?.username ?? "a departed sailor")).join(", ")}
          </span>
        )}
        {known && relic && !solvedByMe && (
          <span className="flex items-center gap-1.5 text-brass-light/80">
            <ItemGlyph glyph={itemInfo(relic).glyph} size={15} /> Rumoured relic: {itemInfo(relic).name}
          </span>
        )}
      </div>

      {isVault && !vaultOpen && (
        <div className="mt-3">
          <p className="font-ui text-[0.58rem] uppercase tracking-[0.3em] text-brass/70">
            Relics in your pack · {held.length}/{REQUIRED_RELICS.length}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {REQUIRED_RELICS.map((r) => (
              <span
                key={r}
                title={itemInfo(r).name}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full border",
                  missing.includes(r) ? "border-parchment/15 text-parchment/20" : "border-gold/70 bg-gold/10 text-gold",
                )}
              >
                <ItemGlyph glyph={itemInfo(r).glyph} size={18} />
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        {blocked ? (
          <p className="font-body italic text-parchment/50">
            {finished ? "The hunt is over." : "The sea has claimed you. Watch over your crew."}
          </p>
        ) : !here ? (
          <Button onClick={onSail} loading={busy} disabled={isVault && !vaultOpen} icon={<ShipIcon size={16} />}>
            {isVault && !vaultOpen ? "The fog will not part" : known ? "Set Sail" : "Sail into the Fog"}
          </Button>
        ) : puzzle && !solvedByMe ? (
          <Button onClick={onInvestigate} disabled={busy} icon={<CompassIcon size={16} />}>
            {isVault ? "Face the Final Puzzle" : "Investigate"}
          </Button>
        ) : (
          <p className="font-body italic text-parchment/55">
            {solvedByMe ? "You have taken all this island will give. Chart a new course." : "Nothing more to find here."}
          </p>
        )}
      </div>
    </motion.section>
  );
}
