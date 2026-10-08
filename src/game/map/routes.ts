/** Adjacency for the demo archipelago — always completable toward The Vault. */
export const ISLAND_ROUTES: Record<string, readonly string[]> = {
  'port-royal': ['blackreef', 'serpent-cay'],
  blackreef: ['port-royal', 'deadmans-shelf', 'widows-rock'],
  'serpent-cay': ['port-royal', 'kraken-shoal'],
  'deadmans-shelf': ['blackreef', 'widows-rock'],
  'widows-rock': ['blackreef', 'deadmans-shelf', 'goldmouth'],
  'kraken-shoal': ['serpent-cay', 'goldmouth'],
  goldmouth: ['widows-rock', 'kraken-shoal', 'the-vault'],
  'the-vault': ['goldmouth'],
};

export function destinationsFrom(islandKey: string | null | undefined): string[] {
  if (!islandKey) return ['port-royal'];
  return [...(ISLAND_ROUTES[islandKey] ?? [])];
}

export function canTravel(fromKey: string | null | undefined, toKey: string): boolean {
  if (toKey === 'port-royal' && !fromKey) return true;
  if (!fromKey) return toKey === 'port-royal';
  if (fromKey === toKey) return true;
  return (ISLAND_ROUTES[fromKey] ?? []).includes(toKey);
}
