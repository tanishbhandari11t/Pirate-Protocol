import type { AvatarId } from "./socket/contract";

export type HatStyle = "bicorne" | "tricorn" | "bandana" | "hood" | "knit" | "none";
export type HairStyle = "short" | "long" | "braids" | "none";
export type BeardStyle = "full" | "goatee" | "mustache" | "stubble" | "none";

export interface AvatarLook {
  skin: string;
  skinShade: string;
  backdrop: [string, string];
  coat: string;
  coatTrim: string;
  hat: HatStyle;
  hatColor: string;
  hatTrim: string;
  hair: HairStyle;
  hairColor: string;
  beard: BeardStyle;
  beardColor: string;
  eyeColor?: string;
  eyepatch?: boolean;
  earring?: boolean;
  scar?: boolean;
  freckles?: boolean;
  wrinkles?: boolean;
  warpaint?: boolean;
  feather?: string;
}

export interface AvatarDefinition {
  id: AvatarId;
  title: string;
  epithet: string;
  look: AvatarLook;
}

export const AVATARS: Record<AvatarId, AvatarDefinition> = {
  captain: {
    id: "captain",
    title: "The Captain",
    epithet: "Feared from Tortuga to the Tempest Reef",
    look: {
      skin: "#d9a47a",
      skinShade: "#b27e57",
      backdrop: ["#1d3552", "#07131d"],
      coat: "#5a1512",
      coatTrim: "#e2b65a",
      hat: "bicorne",
      hatColor: "#17110c",
      hatTrim: "#e2b65a",
      hair: "long",
      hairColor: "#1a120c",
      beard: "full",
      beardColor: "#1a120c",
      earring: true,
      feather: "#c2392f",
    },
  },
  corsair: {
    id: "corsair",
    title: "The Corsair",
    epithet: "Blade-quick, silver-tongued",
    look: {
      skin: "#a8714a",
      skinShade: "#83532f",
      backdrop: ["#4a1b1b", "#12070a"],
      coat: "#1f3a2e",
      coatTrim: "#c89b45",
      hat: "bandana",
      hatColor: "#a3241d",
      hatTrim: "#f3e2c0",
      hair: "short",
      hairColor: "#140d08",
      beard: "goatee",
      beardColor: "#140d08",
      earring: true,
      scar: true,
    },
  },
  navigator: {
    id: "navigator",
    title: "The Navigator",
    epithet: "Reads the stars like scripture",
    look: {
      skin: "#f0c8a0",
      skinShade: "#cf9f76",
      backdrop: ["#123d4a", "#041218"],
      coat: "#1c2f4a",
      coatTrim: "#9cc4cc",
      hat: "tricorn",
      hatColor: "#1c2f4a",
      hatTrim: "#c89b45",
      hair: "short",
      hairColor: "#6b4424",
      beard: "stubble",
      beardColor: "#6b4424",
    },
  },
  gunner: {
    id: "gunner",
    title: "The Gunner",
    epithet: "Smells of powder, speaks in thunder",
    look: {
      skin: "#e0a882",
      skinShade: "#b98161",
      backdrop: ["#3d2a14", "#0e0904"],
      coat: "#2b2b2b",
      coatTrim: "#8a6331",
      hat: "none",
      hatColor: "#000",
      hatTrim: "#000",
      hair: "none",
      hairColor: "#b5542a",
      beard: "full",
      beardColor: "#b5542a",
      eyepatch: true,
      scar: true,
    },
  },
  "sea-witch": {
    id: "sea-witch",
    title: "The Sea Witch",
    epithet: "Bargains with the deep",
    look: {
      skin: "#8a5a3c",
      skinShade: "#6a4128",
      backdrop: ["#0f4a48", "#021312"],
      coat: "#123a3a",
      coatTrim: "#7fc295",
      hat: "hood",
      hatColor: "#0f3434",
      hatTrim: "#7fc295",
      hair: "long",
      hairColor: "#0d0a08",
      beard: "none",
      beardColor: "#000",
      eyeColor: "#6ff0d6",
      earring: true,
      warpaint: true,
    },
  },
  quartermaster: {
    id: "quartermaster",
    title: "The Quartermaster",
    epithet: "Keeps the ledger and the peace",
    look: {
      skin: "#f2c9a5",
      skinShade: "#d4a27c",
      backdrop: ["#4a2c14", "#120a04"],
      coat: "#4a2c14",
      coatTrim: "#e2b65a",
      hat: "tricorn",
      hatColor: "#1a120c",
      hatTrim: "#c2392f",
      hair: "braids",
      hairColor: "#a6361f",
      beard: "none",
      beardColor: "#000",
      earring: true,
      freckles: true,
    },
  },
  "old-salt": {
    id: "old-salt",
    title: "The Old Salt",
    epithet: "Survived three shipwrecks and a kraken",
    look: {
      skin: "#e6b894",
      skinShade: "#bf8f6c",
      backdrop: ["#2c3a44", "#0a0f13"],
      coat: "#34414a",
      coatTrim: "#c9a86b",
      hat: "knit",
      hatColor: "#6d7b83",
      hatTrim: "#4a555c",
      hair: "short",
      hairColor: "#d8d4cc",
      beard: "full",
      beardColor: "#e7e3da",
      wrinkles: true,
    },
  },
  "powder-monkey": {
    id: "powder-monkey",
    title: "The Powder Monkey",
    epithet: "Small, swift, and suspiciously lucky",
    look: {
      skin: "#f5d2ae",
      skinShade: "#d8ab84",
      backdrop: ["#4a3a12", "#120e04"],
      coat: "#6b4a22",
      coatTrim: "#f3e2c0",
      hat: "knit",
      hatColor: "#a3241d",
      hatTrim: "#6e1712",
      hair: "short",
      hairColor: "#d0701f",
      beard: "none",
      beardColor: "#000",
      freckles: true,
    },
  },
};

export const AVATAR_LIST = Object.values(AVATARS);
