export const ITEM_CATALOG = {
  compass: { name: 'Brass Compass', description: 'Needle swings toward the next lie.' },
  spyglass: { name: 'Blackreef Spyglass', description: 'Shows the reef as it was, not as it is.' },
  'serpent-key': { name: 'Serpent Key', description: 'A fang filed into a key.' },
  'widow-chart': { name: "Widow's Chart", description: 'Courses drawn in salt.' },
  'gold-seal': { name: 'Goldmouth Seal', description: 'Opens a mouth that should stay shut.' },
  'tide-rumor': { name: 'Tide Rumor', description: 'A scrap of hearsay. Safe to trade.' },
  'cursed-coin': { name: 'Cursed Coin', description: 'Warm to the touch. Safe to trade, unwise to keep.' },
  'treasure-chest': { name: 'Protocol Chest', description: 'The hoard at the end of the map.' },
} as const;

export type ItemKey = keyof typeof ITEM_CATALOG;

export function isItemKey(itemKey: string): itemKey is ItemKey {
  return Object.prototype.hasOwnProperty.call(ITEM_CATALOG, itemKey);
}

export function itemMeta(itemKey: string) {
  return isItemKey(itemKey) ? ITEM_CATALOG[itemKey] : null;
}
