export const REQUIRED_RELICS = ['compass', 'spyglass', 'serpent-key', 'widow-chart', 'gold-seal'] as const;
export const TRADABLE_ITEMS = ['tide-rumor', 'cursed-coin'] as const;
export const MAX_STRIKES = 3;
export const START_ISLAND_KEY = 'port-royal';

export function missingRelics(itemKeys: readonly string[]) {
  const have = new Set(itemKeys);
  return REQUIRED_RELICS.filter((key) => !have.has(key));
}
