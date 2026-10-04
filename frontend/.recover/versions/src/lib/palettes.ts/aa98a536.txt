import type { AvatarFrame, FlagField, OutfitCoat } from "./socket/contract";

/** Colours for outfit pieces. Kept free of hooks and storage so server-rendered portraits can use them. */

export const COAT_COLORS: Record<OutfitCoat, { coat: string; trim: string }> = {
  crimson: { coat: "#6e1712", trim: "#e2b65a" },
  midnight: { coat: "#141c2b", trim: "#9cc4cc" },
  kelp: { coat: "#24402f", trim: "#c89b45" },
  ash: { coat: "#4b4a47", trim: "#d8d4cc" },
  royal: { coat: "#1d3478", trim: "#f1d68d" },
  gilded: { coat: "#7a5418", trim: "#ffd873" },
};

export const FLAG_COLORS: Record<FlagField, { field: string; ink: string }> = {
  sable: { field: "#14100c", ink: "#efe3c5" },
  navy: { field: "#14284a", ink: "#efe3c5" },
  crimson: { field: "#7d1712", ink: "#f5e8c6" },
  bone: { field: "#e6d6b0", ink: "#2b1b0d" },
  emerald: { field: "#1d5236", ink: "#f5e8c6" },
  royal: { field: "#4a1f63", ink: "#ffd873" },
};

export const FRAME_COLORS: Record<AvatarFrame, { ring: string; shine: string; shadow: string }> = {
  rope: { ring: "#a07b4a", shine: "#d8b47a", shadow: "#4a3218" },
  brass: { ring: "#c89b45", shine: "#f1d68d", shadow: "#6f4f1c" },
  silver: { ring: "#a9b4bb", shine: "#eef3f5", shadow: "#4f5a61" },
  gold: { ring: "#e0b23c", shine: "#fff1b8", shadow: "#7a5414" },
  legend: { ring: "#ffd873", shine: "#fffbe8", shadow: "#8e1f1a" },
};
