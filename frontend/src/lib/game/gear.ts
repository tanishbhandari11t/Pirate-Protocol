"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { RoomCode } from "../socket/contract";
import { createStorageStore } from "../storage";
import { GEAR_SLOTS, gearSlotFor, type GearSlot } from "./items";

/**
 * How this sailor has arranged their hold for one voyage: which tools are fitted and the berth
 * order. Kept per tab and per voyage in session storage; nothing here is sent to the server.
 */
export interface HoldLayout {
  gear: Partial<Record<GearSlot, string>>;
  order: string[];
}

export const EMPTY_LAYOUT: HoldLayout = { gear: {}, order: [] };

/** Drops fitted tools the sailor no longer holds, and anything that doesn't belong in its slot. */
export function fittedGear(layout: HoldLayout, held: ReadonlySet<string>): Partial<Record<GearSlot, string>> {
  const out: Partial<Record<GearSlot, string>> = {};
  for (const slot of Object.keys(GEAR_SLOTS) as GearSlot[]) {
    const key = layout.gear[slot];
    if (key && held.has(key) && gearSlotFor(key) === slot) out[slot] = key;
  }
  return out;
}

export function parseLayout(value: unknown): HoldLayout {
  if (!value || typeof value !== "object") return EMPTY_LAYOUT;
  const v = value as Partial<HoldLayout>;
  const gear: HoldLayout["gear"] = {};
  if (v.gear && typeof v.gear === "object") {
    for (const slot of Object.keys(GEAR_SLOTS) as GearSlot[]) {
      const key = (v.gear as Record<string, unknown>)[slot];
      if (typeof key === "string") gear[slot] = key;
    }
  }
  const order = Array.isArray(v.order) ? v.order.filter((k): k is string => typeof k === "string") : [];
  return { gear, order };
}

const stores = new Map<string, ReturnType<typeof createStorageStore<HoldLayout>>>();

function storeFor(roomCode: RoomCode) {
  let store = stores.get(roomCode);
  if (!store) {
    store = createStorageStore<HoldLayout>("session", `pp:hold:${roomCode}`);
    stores.set(roomCode, store);
  }
  return store;
}

export function useHoldLayout(roomCode: RoomCode, held: ReadonlySet<string>) {
  const store = storeFor(roomCode);
  const raw = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const layout = useMemo(() => parseLayout(raw), [raw]);
  const gear = useMemo(() => fittedGear(layout, held), [layout, held]);

  const equip = useCallback(
    (itemKey: string) => {
      const slot = gearSlotFor(itemKey);
      if (!slot) return null;
      const current = parseLayout(store.get());
      store.set({ ...current, gear: { ...current.gear, [slot]: itemKey } });
      return slot;
    },
    [store],
  );

  const unequip = useCallback(
    (slot: GearSlot) => {
      const current = parseLayout(store.get());
      const next = { ...current.gear };
      delete next[slot];
      store.set({ ...current, gear: next });
    },
    [store],
  );

  const reorder = useCallback(
    (order: string[]) => {
      const current = parseLayout(store.get());
      store.set({ ...current, order });
    },
    [store],
  );

  return { layout, gear, equip, unequip, reorder };
}
