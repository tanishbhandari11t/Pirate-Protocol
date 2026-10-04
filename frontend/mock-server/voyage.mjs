// Cooperative voyage for the practice harbour.
// Each sailor gets a private watch whose answer never leaves the server.
// Kept watches reveal clue words; in order of first appearance they name the island.
import { randomBytes } from "node:crypto";

const BRIEFING =
  "Each sailor keeps their own watch. When every watch is kept, the clues name an island. Tap it to win. Three wrong islands and the hoard is lost.";
const CHART_PROMPT = "Read the clues top to bottom. Together they name the island. Tap that island.";
const MAX_STRIKES = 3;

const ISLANDS = ["Skull Cay", "Black Reef", "Gull Rock", "Serpent Isle", "Widow's Reach", "Rum Rock"].map((name) => ({