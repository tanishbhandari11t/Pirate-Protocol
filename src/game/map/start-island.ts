import { START_ISLAND_KEY } from '../treasure/relics';

type IslandLookup = {
  island: {
    findUnique: (args: {
      where: { key: string };
    }) => Promise<{ id: string; key: string } | null>;
  };
};

// ponytail: process cache; restart after reseed if island ids change.
let cached: { id: string; key: string } | null = null;

export async function resolveStartIsland(db: IslandLookup) {
  if (cached) return cached;
  const island = await db.island.findUnique({ where: { key: START_ISLAND_KEY } });
  if (island) cached = { id: island.id, key: island.key };
  return island;
}
