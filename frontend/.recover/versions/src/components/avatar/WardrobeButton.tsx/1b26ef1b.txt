"use client";

import { useState } from "react";
import { useCrew } from "@/lib/crew/CrewProvider";
import { CAPABILITIES } from "@/lib/socket/backend";
import type { AvatarId } from "@/lib/socket/contract";
import { useSavedOutfit } from "@/lib/storage";
import { CrownIcon } from "../icons";
import { Button, type ButtonSize, type ButtonVariant } from "../ui/Button";
import { Wardrobe } from "./Wardrobe";

interface WardrobeButtonProps {
  avatarId: AvatarId;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
}

/** Opens the wardrobe for this device's sailor. Outfits are saved locally and shown to the crew when the harbour supports it. */
export function WardrobeButton({ avatarId, variant = "parchment", size = "sm", fullWidth, className }: WardrobeButtonProps) {
  const { dressUp } = useCrew();
  const outfit = useSavedOutfit();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        fullWidth={fullWidth}
        className={className}
        icon={<CrownIcon size={16} />}
        onClick={() => setOpen(true)}
        title={CAPABILITIES.outfits ? "Dress your sailor and paint your flag" : "Dress your sailor. This harbour won't show it to the crew yet."}
      >
        Wardrobe
      </Button>
      <Wardrobe open={open} onClose={() => setOpen(false)} avatarId={avatarId} outfit={outfit} onSave={dressUp} />
    </>
  );
}
