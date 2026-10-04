import {
  AVATAR_FRAMES,
  FLAG_BORDERS,
  FLAG_EMBLEMS,
  FLAG_FIELDS,
  OUTFIT_COATS,
  OUTFIT_FACES,
  OUTFIT_HATS,
  OUTFIT_TRINKETS,
  type AvatarFrame,
  type FlagBorder,
  type FlagEmblem,
  type FlagField,
  type Outfit,
  type OutfitCoat,
  type OutfitFace,
  type OutfitHat,
  type OutfitTrinket,
} from "./socket/contract";
import { achievementById } from "./game/achievements";
import { isLegend, type CareerTotals } from "./game/career";

/* ------------------------------------------------------------------ */
/* Unlock rules                                                        */
/* ------------------------------------------------------------------ */

export interface UnlockRule {
  /** What the sailor has to do, written for the wardrobe's lock tooltip. */
  requirement: string;
  met: (totals: CareerTotals) => boolean;
  /** `[current, goal]` for rules that count something; omitted for one-off honours. */
  progress?: (totals: CareerTotals) => [number, number];
}

const count = (label: string, goal: number, read: (t: CareerTotals) => number): Required<UnlockRule> => ({
  requirement: label,
  met: (t) => read(t) >= goal,
  progress: (t) => [Math.min(read(t), goal), goal],
});

const honour = (id: string): UnlockRule => ({
  requirement: `Earn the “${achievementById(id)?.title ?? id}” honour`,
  met: (t) => t.honours.has(id),
});

export const UNLOCKS = {
  free: { requirement: "Yours from the start", met: () => true },
  firstVoyage: count("Finish a voyage", 1, (t) => t.voyages),
  threeVoyages: count("Finish three voyages", 3, (t) => t.voyages),
  fiveVoyages: count("Finish five voyages", 5, (t) => t.voyages),
  tenSolves: count("Solve ten puzzles across your voyages", 10, (t) => t.solved),
  fullHold: count("Finish a voyage holding all five relics", 1, (t) => t.fullHolds),
  firstWin: count("Open the Vault once", 1, (t) => t.wins),
  threeWins: count("Open the Vault three times", 3, (t) => t.wins),
  vaultBreaker: honour("vault-breaker"),
  relicHunter: honour("relic-hunter"),
  firstRiddle: honour("first-riddle"),
  unbroken: honour("unbroken"),
  scarred: honour("scarred"),
  generous: honour("generous"),
  cartographer: honour("cartographer"),
  ghost: honour("ghost"),
  legend: {
    requirement: "Earn every honour in the book",
    met: isLegend,
  },
} satisfies Record<string, UnlockRule>;

export type UnlockId = keyof typeof UNLOCKS;

/* ------------------------------------------------------------------ */
/* Catalogue                                                           */
/* ------------------------------------------------------------------ */

export interface Cosmetic<T extends string> {
  id: T;
  name: string;
  flavour: string;
  unlock: UnlockId;
}

export const HATS: Record<OutfitHat, Cosmetic<OutfitHat>> = {
  tricorn: { id: "tricorn", name: "Tricorn", flavour: "Three corners, no excuses.", unlock: "free" },
  bandana: { id: "bandana", name: "Bandana", flavour: "Keeps the sweat out and the secrets in.", unlock: "free" },
  knit: { id: "knit", name: "Watch Cap", flavour: "Knitted on a night watch that never ended.", unlock: "firstVoyage" },
  bicorne: { id: "bicorne", name: "Bicorne", flavour: "Worn sideways by those who have earned it.", unlock: "threeVoyages" },
  hood: { id: "hood", name: "Drowned Hood", flavour: "Still damp. It always will be.", unlock: "ghost" },
  plumed: { id: "plumed", name: "Plumed Hat", flavour: "A feather for every relic in the hold.", unlock: "relicHunter" },
  "skull-cap": { id: "skull-cap", name: "Skull Cap", flavour: "Stitched from the sail of a trapped ship.", unlock: "scarred" },
  crown: { id: "crown", name: "Corsair's Crown", flavour: "Three Vaults. One head heavy enough to wear it.", unlock: "threeWins" },
};

export const COATS: Record<OutfitCoat, Cosmetic<OutfitCoat>> = {
  crimson: { id: "crimson", name: "Crimson Coat", flavour: "Hides the stains well.", unlock: "free" },
  midnight: { id: "midnight", name: "Midnight Coat", flavour: "For sailing without lanterns.", unlock: "free" },
  kelp: { id: "kelp", name: "Kelp Coat", flavour: "Smells of low tide and good fortune.", unlock: "firstVoyage" },
  ash: { id: "ash", name: "Ashen Coat", flavour: "Faded by five suns and as many storms.", unlock: "fiveVoyages" },
  royal: { id: "royal", name: "Admiralty Blue", flavour: "Taken from an admiral who asked too many questions.", unlock: "vaultBreaker" },
  gilded: { id: "gilded", name: "Gilded Coat", flavour: "Thread-of-gold for a mind that cracks riddles.", unlock: "tenSolves" },
};

export const FACES: Record<OutfitFace, Cosmetic<OutfitFace>> = {
  eyepatch: { id: "eyepatch", name: "Eyepatch", flavour: "One eye on the horizon, one on the deck.", unlock: "free" },
  monocle: { id: "monocle", name: "Brass Monocle", flavour: "For reading the small print on curses.", unlock: "firstRiddle" },
  scar: { id: "scar", name: "Trap Scar", flavour: "The trap missed. Mostly.", unlock: "scarred" },
  warpaint: { id: "warpaint", name: "Chart Marks", flavour: "Every island you have charted, inked under the eye.", unlock: "cartographer" },
};

export const TRINKETS: Record<OutfitTrinket, Cosmetic<OutfitTrinket>> = {
  hoops: { id: "hoops", name: "Gold Hoops", flavour: "Payment for your own burial at sea.", unlock: "free" },
  parrot: { id: "parrot", name: "Ship's Parrot", flavour: "Repeats every trade you have ever made.", unlock: "generous" },
  pipe: { id: "pipe", name: "Clay Pipe", flavour: "Lit on the third voyage, never put out.", unlock: "threeVoyages" },
  "gold-tooth": { id: "gold-tooth", name: "Gold Tooth", flavour: "Bitten from the Vault's first coin.", unlock: "firstWin" },
  medal: { id: "medal", name: "Unbroken Medal", flavour: "Awarded for a voyage without a scratch.", unlock: "unbroken" },
};

export const FRAMES: Record<AvatarFrame, Cosmetic<AvatarFrame>> = {
  rope: { id: "rope", name: "Rope Ring", flavour: "Every sailor starts on the ropes.", unlock: "free" },
  brass: { id: "brass", name: "Brass Porthole", flavour: "Three voyages and the ship knows your face.", unlock: "threeVoyages" },
  silver: { id: "silver", name: "Silver Bezel", flavour: "Polished by ten solved riddles.", unlock: "tenSolves" },
  gold: { id: "gold", name: "Gold Bezel", flavour: "For a captain the Vault opens for.", unlock: "threeWins" },
  legend: { id: "legend", name: "Legend's Laurel", flavour: "Every honour in the book. The sea remembers.", unlock: "legend" },
};

export const FLAG_FIELD_INFO: Record<FlagField, Cosmetic<FlagField>> = {
  sable: { id: "sable", name: "Sable", flavour: "Black as the deep.", unlock: "free" },
  navy: { id: "navy", name: "Navy", flavour: "Deep water blue.", unlock: "free" },
  crimson: { id: "crimson", name: "Crimson", flavour: "No quarter given.", unlock: "scarred" },
  bone: { id: "bone", name: "Bone", flavour: "Bleached by charted suns.", unlock: "cartographer" },
  emerald: { id: "emerald", name: "Emerald", flavour: "Green as an honest bargain.", unlock: "generous" },
  royal: { id: "royal", name: "Royal Purple", flavour: "Only Vault breakers fly it.", unlock: "firstWin" },
};

export const FLAG_EMBLEM_INFO: Record<FlagEmblem, Cosmetic<FlagEmblem>> = {
  skull: { id: "skull", name: "Skull & Bones", flavour: "The old standard.", unlock: "free" },
  "crossed-swords": { id: "crossed-swords", name: "Crossed Blades", flavour: "Ready for a fight.", unlock: "free" },
  anchor: { id: "anchor", name: "Anchor", flavour: "Home is wherever it drops.", unlock: "firstVoyage" },
  compass: { id: "compass", name: "Compass Rose", flavour: "All five relics, all four winds.", unlock: "relicHunter" },
  kraken: { id: "kraken", name: "Kraken", flavour: "Flown by those the sea took back.", unlock: "ghost" },
  hourglass: { id: "hourglass", name: "Hourglass", flavour: "Time served on five voyages.", unlock: "fiveVoyages" },
  serpent: { id: "serpent", name: "Sea Serpent", flavour: "First to the riddle, first to strike.", unlock: "firstRiddle" },
  crown: { id: "crown", name: "Crown", flavour: "Three Vaults opened.", unlock: "threeWins" },
};

export const FLAG_BORDER_INFO: Record<FlagBorder, Cosmetic<FlagBorder>> = {
  plain: { id: "plain", name: "Plain Hem", flavour: "Clean edges, for now.", unlock: "free" },
  tattered: { id: "tattered", name: "Tattered", flavour: "Shredded by a real voyage.", unlock: "firstVoyage" },
  gilded: { id: "gilded", name: "Gilded Hem", flavour: "Gold thread from the Vault itself.", unlock: "fullHold" },
};

/* ------------------------------------------------------------------ */
/* Slots                                                               */
/* ------------------------------------------------------------------ */

export type WardrobeSlot = "hat" | "coat" | "face" | "trinket" | "frame" | "field" | "emblem" | "border";

interface SlotInfo {
  label: string;
  /** Pieces in display order. */
  ids: readonly string[];
  catalogue: Record<string, Cosmetic<string>>;
  /** Slots that may be left empty to keep the base likeness. */
  optional: boolean;
}

export const SLOTS: Record<WardrobeSlot, SlotInfo> = {
  hat: { label: "Hat", ids: OUTFIT_HATS, catalogue: HATS, optional: true },
  coat: { label: "Coat", ids: OUTFIT_COATS, catalogue: COATS, optional: true },
  face: { label: "Face", ids: OUTFIT_FACES, catalogue: FACES, optional: true },
  trinket: { label: "Trinket", ids: OUTFIT_TRINKETS, catalogue: TRINKETS, optional: true },
  frame: { label: "Frame", ids: AVATAR_FRAMES, catalogue: FRAMES, optional: true },
  field: { label: "Flag colour", ids: FLAG_FIELDS, catalogue: FLAG_FIELD_INFO, optional: false },
  emblem: { label: "Emblem", ids: FLAG_EMBLEMS, catalogue: FLAG_EMBLEM_INFO, optional: false },
  border: { label: "Hem", ids: FLAG_BORDERS, catalogue: FLAG_BORDER_INFO, optional: false },
};

export const WARDROBE_SLOTS = Object.keys(SLOTS) as WardrobeSlot[];

export function cosmeticFor(slot: WardrobeSlot, id: string): Cosmetic<string> | null {
  return SLOTS[slot].catalogue[id] ?? null;
}

export function isUnlocked(slot: WardrobeSlot, id: string, totals: CareerTotals) {
  const piece = cosmeticFor(slot, id);
  return !!piece && UNLOCKS[piece.unlock].met(totals);
}

/** What the outfit wears in one slot. */
export function pieceIn(outfit: Outfit, slot: WardrobeSlot): string | null {
  switch (slot) {
    case "field":
      return outfit.flag.field;
    case "emblem":
      return outfit.flag.emblem;
    case "border":
      return outfit.flag.border;
    default:
      return outfit[slot];
  }
}

/** The outfit with one slot changed. `null` empties optional slots; required ones ignore it. */
export function wearing(outfit: Outfit, slot: WardrobeSlot, id: string | null): Outfit {
  switch (slot) {
    case "field":
      return id ? { ...outfit, flag: { ...outfit.flag, field: id as FlagField } } : outfit;
    case "emblem":
      return id ? { ...outfit, flag: { ...outfit.flag, emblem: id as FlagEmblem } } : outfit;
    case "border":
      return id ? { ...outfit, flag: { ...outfit.flag, border: id as FlagBorder } } : outfit;
    default:
      return { ...outfit, [slot]: id };
  }
}

const FIRST_FREE: Record<"field" | "emblem" | "border", string> = { field: "sable", emblem: "skull", border: "plain" };

/** Strips any piece the sailor has not earned (say, after clearing their career), keeping the rest. */
export function earnedOutfit(outfit: Outfit, totals: CareerTotals): Outfit {
  let next = outfit;
  for (const slot of WARDROBE_SLOTS) {
    const id = pieceIn(next, slot);
    if (id === null || isUnlocked(slot, id, totals)) continue;
    next = SLOTS[slot].optional ? wearing(next, slot, null) : wearing(next, slot, FIRST_FREE[slot as keyof typeof FIRST_FREE]);
  }
  return next;
}

export interface Unlocked {
  slot: WardrobeSlot;
  piece: Cosmetic<string>;
}

/** Pieces that were locked under `before` and are open under `after`. */
export function newlyUnlocked(before: CareerTotals, after: CareerTotals): Unlocked[] {
  const found: Unlocked[] = [];
  for (const slot of WARDROBE_SLOTS) {
    for (const id of SLOTS[slot].ids) {
      const piece = cosmeticFor(slot, id)!;
      const rule = UNLOCKS[piece.unlock];
      if (!rule.met(before) && rule.met(after)) found.push({ slot, piece });
    }
  }
  return found;
}

/** How much of the wardrobe is open, for the progress line under the tabs. */
export function wardrobeProgress(totals: CareerTotals) {
  let open = 0;
  let total = 0;
  for (const slot of WARDROBE_SLOTS) {
    for (const id of SLOTS[slot].ids) {
      total += 1;
      if (isUnlocked(slot, id, totals)) open += 1;
    }
  }
  return { open, total };
}
