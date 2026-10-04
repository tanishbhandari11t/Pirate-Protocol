const ADJECTIVES = [
  "Crimson", "Salted", "Drowned", "Gilded", "Howling", "Black", "Silent", "Wicked",
  "Iron", "Rusted", "Midnight", "Storm", "Grinning", "Bone", "Emerald", "Cursed",
];

const NOUNS = [
  "Kraken", "Gull", "Serpent", "Doubloon", "Tide", "Lantern", "Widow", "Cutlass",
  "Reef", "Parrot", "Mermaid", "Anchor", "Tempest", "Revenant", "Compass", "Hound",
];

function pick<T>(list: readonly T[]) {
  return list[Math.floor(Math.random() * list.length)];
}

/** Random crew name; call from event handlers only (not during render). */
export function randomCrewName() {
  return `The ${pick(ADJECTIVES)} ${pick(NOUNS)}`;
}

/** Crew name without a leading article, for prose like "the Salted Kraken". */
export function bareShipName(crewName: string) {
  return crewName.replace(/^the\s+/i, "");
}
