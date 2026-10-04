import {
  ITEM_KEYS,
  REQUIRED_RELICS,
  SCORE_RULES,
  isRelicKey,
  isTradableKey,
  type InventoryItem,
  type VoyageSettings,
} from "../socket/contract";
import { itemInfo, type ItemInfo, type Rarity } from "./world";

/**
 * What each item in the hold actually does, in the server's own terms. Abilities are read from
 * the published rules (the Vault's relic check, hint payments, trade rules, scoring), never invented.
 * Gear slots are presentation: equipping a tool changes what this screen draws, not what the server allows.
 */

export type AbilityKind = "vault" | "hint" | "trade" | "score" | "bound" | "curse" | "treasure" | "gear";

export interface Ability {
  kind: AbilityKind;
  label: string;
  detail: string;
}

/** Where a navigation tool can be fitted. */
export type GearSlot = "helm" | "glass";

export const GEAR_SLOTS: Record<GearSlot, { label: string; accepts: readonly string[]; empty: string }> = {
  helm: { label: "Helm", accepts: ["compass", "widow-chart"], empty: "Fit a compass or a chart" },
  glass: { label: "Lookout", accepts: ["spyglass"], empty: "Fit a spyglass" },
};

export const GEAR_EFFECT: Record<string, string> = {
  compass: "Shows the bearing to your next destination on the deck.",
  "widow-chart": "Traces your course to the next destination across the map.",
  spyglass: "Marks how many leagues lie between you and every charted island.",
};

/** One berth per kind of item the sea can give; stacks share a berth. */
export const HOLD_BERTHS = ITEM_KEYS.length;

export const RARITY_RANK: Record<Rarity, number> = { legendary: 3, relic: 2, common: 1, cursed: 0 };

export function gearSlotFor(itemKey: string): GearSlot | null {
  for (const [slot, info] of Object.entries(GEAR_SLOTS) as [GearSlot, (typeof GEAR_SLOTS)[GearSlot]][]) {
    if (info.accepts.includes(itemKey)) return slot;
  }
  return null;
}

export function itemAbilities(itemKey: string, settings: Pick<VoyageSettings, "hintsEnabled">): Ability[] {
  const abilities: Ability[] = [];
  if (isRelicKey(itemKey)) {
    abilities.push({
      kind: "vault",
      label: "Vault relic",
      detail: `One of the ${REQUIRED_RELICS.length} relics the Vault demands in your own hold.`,
    });
    abilities.push({ kind: "score", label: `+${SCORE_RULES.perRelic} points`, detail: "Counted at the final tally for every relic earned." });
    abilities.push({ kind: "bound", label: "Bound", detail: "Earned, not bought: it cannot change hands." });
  }
  if (itemKey === "tide-rumor" && settings.hintsEnabled) {
    abilities.push({ kind: "hint", label: "Pays for a hint", detail: "Spend it on a whisper instead of taking a strike." });
  }
  if (itemKey === "cursed-coin") {
    abilities.push({ kind: "curse", label: "Trap token", detail: "Left behind by a sprung trap. It only whispers; keep it or pass it on." });
  }
  if (itemKey === "treasure-chest") {
    abilities.push({ kind: "treasure", label: `+${SCORE_RULES.treasure} points`, detail: "The hoard itself, for the sailor who opened the Vault." });
  }
  if (isTradableKey(itemKey)) {
    abilities.push({ kind: "trade", label: "Tradeable", detail: "Drag it onto a crewmate to offer it." });
  }
  const slot = gearSlotFor(itemKey);
  if (slot) abilities.push({ kind: "gear", label: `Fits the ${GEAR_SLOTS[slot].label}`, detail: GEAR_EFFECT[itemKey] });
  return abilities;
}

export interface ItemProfile {
  item: InventoryItem;
  info: ItemInfo;
  abilities: Ability[];
  gear: GearSlot | null;
}

export function profileOf(item: InventoryItem, settings: Pick<VoyageSettings, "hintsEnabled">): ItemProfile {
  return { item, info: itemInfo(item.itemKey), abilities: itemAbilities(item.itemKey, settings), gear: gearSlotFor(item.itemKey) };
}

/** Side-by-side comparison rows for two items. `better` says which side wins that row, if either. */
export interface CompareRow {
  label: string;
  left: string;
  right: string;
  better: "left" | "right" | null;
}

export function compareItems(a: ItemProfile, b: ItemProfile): CompareRow[] {
  const rank = (p: ItemProfile) => RARITY_RANK[p.info.rarity];
  const pick = (l: number, r: number): CompareRow["better"] => (l > r ? "left" : r > l ? "right" : null);
  const has = (p: ItemProfile, kind: AbilityKind) => p.abilities.some((x) => x.kind === kind);
  const yesNo = (v: boolean) => (v ? "Yes" : "No");
  return [
    { label: "Rarity", left: a.info.rarity, right: b.info.rarity, better: pick(rank(a), rank(b)) },
    { label: "Opens the Vault", left: yesNo(has(a, "vault")), right: yesNo(has(b, "vault")), better: pick(+has(a, "vault"), +has(b, "vault")) },
    { label: "Tradeable", left: yesNo(has(a, "trade")), right: yesNo(has(b, "trade")), better: null },
    { label: "Pays for hints", left: yesNo(has(a, "hint")), right: yesNo(has(b, "hint")), better: pick(+has(a, "hint"), +has(b, "hint")) },
    {
      label: "Gear slot",
      left: a.gear ? GEAR_SLOTS[a.gear].label : "None",
      right: b.gear ? GEAR_SLOTS[b.gear].label : "None",
      better: pick(+!!a.gear, +!!b.gear),
    },
    { label: "Held", left: `×${a.item.quantity}`, right: `×${b.item.quantity}`, better: pick(a.item.quantity, b.item.quantity) },
  ];
}

/** Applies a saved berth order to the hold, putting anything new at the end in rarity order. */
export function arrangeHold(items: InventoryItem[], order: readonly string[]): InventoryItem[] {
  const pos = new Map(order.map((key, i) => [key, i]));
  return [...items].sort((a, b) => {
    const pa = pos.get(a.itemKey);
    const pb = pos.get(b.itemKey);
    if (pa !== undefined && pb !== undefined) return pa - pb;
    if (pa !== undefined) return -1;
    if (pb !== undefined) return 1;
    return RARITY_RANK[itemInfo(b.itemKey).rarity] - RARITY_RANK[itemInfo(a.itemKey).rarity];
  });
}

/** Moves one item key to `index` in the berth order. */
export function moveBerth(order: readonly string[], itemKey: string, index: number): string[] {
  const without = order.filter((k) => k !== itemKey);
  const at = Math.max(0, Math.min(index, without.length));
  return [...without.slice(0, at), itemKey, ...without.slice(at)];
}
