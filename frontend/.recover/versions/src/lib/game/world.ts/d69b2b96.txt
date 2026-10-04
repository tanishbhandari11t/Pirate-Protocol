import type { RelicKey } from "../socket/contract";

/**
 * Presentation-only knowledge about the seeded world: flavour text, rarity and glyphs.
 * Nothing here decides an outcome — the server grades answers, grants items and springs traps.
 */

export type Rarity = "common" | "cursed" | "relic" | "legendary";
export type ItemGlyph = "compass" | "spyglass" | "key" | "chart" | "seal" | "rumor" | "coin" | "chest";

export interface ItemInfo {
  name: string;
  glyph: ItemGlyph;
  rarity: Rarity;
  tradable: boolean;
  /** Longer line shown when the item is first found. */
  lore: string;
}

export const ITEM_INFO: Record<string, ItemInfo> = {
  compass: {
    name: "Brass Compass",
    glyph: "compass",
    rarity: "relic",
    tradable: false,
    lore: "An old navigator's compass. It points toward something that shouldn't exist.",
  },
  spyglass: {
    name: "Blackreef Spyglass",
    glyph: "spyglass",
    rarity: "relic",
    tradable: false,
    lore: "Look through it and the reef is whole again — and so are the ships it swallowed.",
  },
  "serpent-key": {
    name: "Serpent Key",
    glyph: "key",
    rarity: "relic",
    tradable: false,
    lore: "A fang filed into a key. It is still faintly warm.",
  },
  "widow-chart": {
    name: "Widow's Chart",
    glyph: "chart",
    rarity: "relic",
    tradable: false,
    lore: "Courses drawn in salt by someone who never came home. One line ends at a door.",
  },
  "gold-seal": {
    name: "Goldmouth Seal",
    glyph: "seal",
    rarity: "relic",
    tradable: false,
    lore: "Pressed from the cave's own gold. It opens a mouth that should stay shut.",
  },
  "tide-rumor": {
    name: "Tide Rumor",
    glyph: "rumor",
    rarity: "common",
    tradable: true,
    lore: "A scrap of hearsay passed hand to hand. Worth little — unless a crewmate needs it.",
  },
  "cursed-coin": {
    name: "Cursed Coin",
    glyph: "coin",
    rarity: "cursed",
    tradable: true,
    lore: "Warm to the touch. It whispers your name when the lanterns gutter. Best passed along.",
  },
  "treasure-chest": {
    name: "Protocol Chest",
    glyph: "chest",
    rarity: "legendary",
    tradable: false,
    lore: "The hoard at the end of the map.",
  },
};

export function itemInfo(itemKey: string): ItemInfo {
  return (
    ITEM_INFO[itemKey] ?? {
      name: itemKey.replace(/-/g, " "),
      glyph: "rumor",
      rarity: "common",
      tradable: false,
      lore: "",
    }
  );
}

export const RARITY_LABEL: Record<Rarity, string> = {
  common: "Common",
  cursed: "Cursed",
  relic: "Relic",
  legendary: "Legendary",
};

/** Which relic each island's puzzle yields, as documented by the backend seed. */
export const ISLAND_RELIC: Partial<Record<string, RelicKey>> = {
  "port-royal": "compass",
  blackreef: "spyglass",
  "serpent-cay": "serpent-key",
  "widows-rock": "widow-chart",
  goldmouth: "gold-seal",
};

/** Two short beats played while the ship drops anchor. */
export const ISLAND_ARRIVAL: Record<string, [string, string]> = {
  "port-royal": ["Gulls wheel over the last honest dock.", "A harbour clerk pretends not to see you."],
  blackreef: ["Black stone teeth rise from the swell.", "On the cliff, an old signal fire still smoulders."],
  "serpent-cay": ["The sand shifts beneath the hull.", "Something long and patient coils in the shallows."],
  "deadmans-shelf": ["A chest sits alone on the rock.", "Nobody leaves a chest in the open by accident."],
  "widows-rock": ["Wind tears at charts nailed to the cliff.", "Every one of them points somewhere different."],
  "kraken-shoal": ["The sea has gone silent.", "Something enormous moved beneath your ship."],
  goldmouth: ["A cave mouth glitters at the waterline.", "Its echo answers before you speak."],
  "the-vault": ["The fog parts like a curtain.", "A door of black iron waits, listening."],
};

export interface CipherInfo {
  title: string;
  glyphs: string;
  hint: string;
}

export const CIPHER_INFO: Record<string, CipherInfo> = {
  riddle: { title: "The Sphinx's Riddle", glyphs: "☾ ✦ ☉ ✦ ☽", hint: "Answer in a single word." },
  caesar: { title: "The Captain's Cipher", glyphs: "⚓ ☠ ◇ ☀ ⚓ ◇ ☠", hint: "Shift each letter back to read the message." },
  anagram: { title: "The Scrambled Name", glyphs: "∿ ∾ ∿ ∾ ∿", hint: "Rearrange the letters." },
  choice: { title: "A Grave Decision", glyphs: "☠ ⚔ ☠", hint: "Choose carefully. Some answers bite." },
  token: { title: "The Final Protocol", glyphs: "✠ ◈ ✠ ◈ ✠", hint: "Speak the words the door is waiting for." },
};

export function cipherInfo(cipher: string): CipherInfo {
  return CIPHER_INFO[cipher] ?? { title: "An Ancient Puzzle", glyphs: "◇ ◆ ◇", hint: "Answer as the sea would." };
}
