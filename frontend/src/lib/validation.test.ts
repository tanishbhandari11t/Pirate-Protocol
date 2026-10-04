import { afterEach, describe, expect, it, vi } from "vitest";
import { ROOM_CODE_LENGTH } from "./socket/contract";

/** `BACKEND` is read once at import time, so each mode gets a fresh copy of the module. */
async function load(mode: "protocol" | "nest") {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_BACKEND", mode === "nest" ? "nest" : "");
  return import("./validation");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("player names", () => {
  it("are tidied before checking", async () => {
    const { normalizeName } = await load("protocol");
    expect(normalizeName("  Anne    Bonny ")).toBe("Anne Bonny");
  });

  it.each([
    ["A", "Every pirate needs a name of at least 2 letters."],
    ["   ", "Every pirate needs a name of at least 2 letters."],
    ["Bartholomew Roberts", "Keep it under 16 letters, sailor."],
    ["Anne <script>", "Only letters, numbers and simple marks."],
  ])("reject %j", async (name, message) => {
    const { validatePlayerName } = await load("protocol");
    expect(validatePlayerName(name)).toBe(message);
  });

  it.each(["Anne Bonny", "Zoë", "O'Malley", "Jack-o.", "Captain 42"])("accept %j with the full protocol", async (name) => {
    const { validatePlayerName } = await load("protocol");
    expect(validatePlayerName(name)).toBeNull();
  });

  it.each(["Zoë", "O'Malley", "Jack-o."])("refuse %j for the Nest harbour's plain names", async (name) => {
    const { validatePlayerName } = await load("nest");
    expect(validatePlayerName(name)).toBe("This harbour only reads plain letters, numbers and spaces.");
  });

  it("asks the Nest harbour for three usable letters", async () => {
    const { validatePlayerName } = await load("nest");
    expect(validatePlayerName("Al")).toBe("Every pirate needs a name of at least 3 letters.");
    expect(validatePlayerName("Al B")).toBeNull();
  });
});

describe("crew names", () => {
  it.each([
    ["Ab", "A crew name needs at least 3 letters."],
    ["The Unbelievably Long Ship Name", "Keep it under 24 letters."],
    ["The <Gull>", "Only letters, numbers and simple marks."],
  ])("reject %j", async (name, message) => {
    const { validateCrewName } = await load("protocol");
    expect(validateCrewName(name)).toBe(message);
  });

  it.each(["The Black Gull", "Rum & Ruin!", "Ship No. 7"])("accept %j", async (name) => {
    const { validateCrewName } = await load("protocol");
    expect(validateCrewName(name)).toBeNull();
  });
});

describe("room codes", () => {
  it("drop characters that never appear in a code", async () => {
    const { sanitizeRoomCode } = await load("protocol");
    expect(sanitizeRoomCode("ab-c 2o1-34")).toBe("ABC234");
  });

  it("never grow past the code length", async () => {
    const { sanitizeRoomCode } = await load("protocol");
    expect(sanitizeRoomCode("ABCDEFGHJK")).toHaveLength(ROOM_CODE_LENGTH);
  });

  it("need every rune", async () => {
    const { validateRoomCode } = await load("protocol");
    expect(validateRoomCode("ABC23")).toBe(`The code has ${ROOM_CODE_LENGTH} runes.`);
    expect(validateRoomCode("abc234")).toBeNull();
  });
});
