import { existsSync, readFileSync } from 'fs';
import { IslandKind, PrismaClient } from '@prisma/client';
import { hashAnswer } from '../src/game/engine/answer';

function loadEnvFile() {
  if (!existsSync('.env')) return;
  for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const splitAt = trimmed.indexOf('=');
    if (splitAt === -1) continue;
    const key = trimmed.slice(0, splitAt).trim();
    if (process.env[key] === undefined) process.env[key] = trimmed.slice(splitAt + 1).trim();
  }
}

const islands: {
  key: string;
  name: string;
  description: string;
  x: number;
  y: number;
  order: number;
  kind: IslandKind;
}[] = [
  {
    key: 'port-royal',
    name: 'Port Royal',
    description: 'The last honest dock on a dishonest sea. Voyages are counted here, then forgotten.',
    x: 12,
    y: 70,
    order: 1,
    kind: IslandKind.NORMAL,
  },
  {
    key: 'blackreef',
    name: 'Blackreef',
    description: 'Stone teeth under black water. The old signal fire still spells a word nobody says aloud.',
    x: 28,
    y: 48,
    order: 2,
    kind: IslandKind.NORMAL,
  },
  {
    key: 'serpent-cay',
    name: 'Serpent Cay',
    description: 'A coil of sand that shifts when the moon is insulted.',
    x: 46,
    y: 62,
    order: 3,
    kind: IslandKind.NORMAL,
  },
  {
    key: 'deadmans-shelf',
    name: "Deadman's Shelf",
    description: 'A chest sits in the open, which is how you know it is not a gift.',
    x: 40,
    y: 30,
    order: 4,
    kind: IslandKind.TRAP,
  },
  {
    key: 'widows-rock',
    name: "Widow's Rock",
    description: 'Charts nailed to the cliff so the wind can argue with them.',
    x: 63,
    y: 44,
    order: 5,
    kind: IslandKind.NORMAL,
  },
  {
    key: 'kraken-shoal',
    name: 'Kraken Shoal',
    description: 'The water here has too many elbows.',
    x: 72,
    y: 68,
    order: 6,
    kind: IslandKind.TRAP,
  },
  {
    key: 'goldmouth',
    name: 'Goldmouth',
    description: 'A cave that pays in echoes and collects in blood.',
    x: 80,
    y: 28,
    order: 7,
    kind: IslandKind.NORMAL,
  },
  {
    key: 'the-vault',
    name: 'The Vault',
    description: 'Not buried. Waiting. The door listens for five relics and one protocol.',
    x: 90,
    y: 14,
    order: 8,
    kind: IslandKind.TREASURE,
  },
];

const puzzles: {
  key: string;
  islandKey: string;
  prompt: string;
  cipher: string;
  answer: string;
  rewardKey: string | null;
  trapOnFail: boolean;
  order: number;
}[] = [
  {
    key: 'port-royal-map',
    islandKey: 'port-royal',
    prompt: 'I show every shore and none of the sea\'s depth. Sailors fold me until I tear. What am I?',
    cipher: 'riddle',
    answer: 'map',
    rewardKey: 'compass',
    trapOnFail: false,
    order: 1,
  },
  {
    key: 'blackreef-cipher',
    islandKey: 'blackreef',
    prompt: 'Each letter was moved 3 places forward in the alphabet. Decode: wuhdvxuh',
    cipher: 'caesar',
    answer: 'treasure',
    rewardKey: 'spyglass',
    trapOnFail: false,
    order: 1,
  },
  {
    key: 'serpent-anagram',
    islandKey: 'serpent-cay',
    prompt: 'The cay hisses a scrambled name. Rearrange: PENREST',
    cipher: 'anagram',
    answer: 'serpent',
    rewardKey: 'serpent-key',
    trapOnFail: false,
    order: 1,
  },
  {
    key: 'deadman-plaque',
    islandKey: 'deadmans-shelf',
    prompt: 'The plaque reads DO NOT OPEN. The only safe order is a single word. What do you do?',
    cipher: 'choice',
    answer: 'leave',
    rewardKey: null,
    trapOnFail: true,
    order: 1,
  },
  {
    key: 'widow-riddle',
    islandKey: 'widows-rock',
    prompt: 'What vanishes the moment you speak its name?',
    cipher: 'riddle',
    answer: 'silence',
    rewardKey: 'widow-chart',
    trapOnFail: false,
    order: 1,
  },
  {
    key: 'kraken-arms',
    islandKey: 'kraken-shoal',
    prompt: 'A kraken shows eight arms. How many will you grasp? Answer with a digit.',
    cipher: 'choice',
    answer: '0',
    rewardKey: 'tide-rumor',
    trapOnFail: true,
    order: 1,
  },
  {
    key: 'goldmouth-tides',
    islandKey: 'goldmouth',
    prompt: 'Two high, two low. How many tides mark a day? Answer with the number-word.',
    cipher: 'riddle',
    answer: 'four',
    rewardKey: 'gold-seal',
    trapOnFail: false,
    order: 1,
  },
  {
    key: 'vault-protocol',
    islandKey: 'the-vault',
    prompt: 'The door counts five relics, then asks the name of this hunt. Two words.',
    cipher: 'token',
    answer: 'pirate protocol',
    rewardKey: 'treasure-chest',
    trapOnFail: false,
    order: 1,
  },
];

async function main() {
  loadEnvFile();
  const pepper = process.env.APP_SECRET;
  if (!pepper || pepper.length < 16) throw new Error('APP_SECRET must be at least 16 characters');
  if (!process.env.DATABASE_URL?.startsWith('postgresql://')) {
    throw new Error('DATABASE_URL must be a postgresql:// connection string');
  }

  const prisma = new PrismaClient();
  try {
    for (const island of islands) {
      await prisma.island.upsert({
        where: { key: island.key },
        update: island,
        create: island,
      });
    }

    for (const puzzle of puzzles) {
      const island = await prisma.island.findUniqueOrThrow({ where: { key: puzzle.islandKey } });
      const data = {
        prompt: puzzle.prompt,
        cipher: puzzle.cipher,
        answerHash: hashAnswer(puzzle.answer, pepper),
        rewardKey: puzzle.rewardKey,
        trapOnFail: puzzle.trapOnFail,
        order: puzzle.order,
        islandId: island.id,
      };
      await prisma.puzzle.upsert({
        where: { key: puzzle.key },
        update: data,
        create: { key: puzzle.key, ...data },
      });
    }

    const [islandCount, puzzleCount] = await Promise.all([prisma.island.count(), prisma.puzzle.count()]);
    console.log(`Seeded ${islandCount} islands and ${puzzleCount} puzzles`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
