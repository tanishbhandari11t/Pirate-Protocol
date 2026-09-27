"use client";

import { useState, type ReactNode } from "react";
import { AvatarPicker } from "@/components/avatar/AvatarPicker";
import { PirateAvatar } from "@/components/avatar/PirateAvatar";
import { Porthole } from "@/components/avatar/Porthole";
import { CompassRose } from "@/components/brand/CompassRose";
import { Logo } from "@/components/brand/Logo";
import { CrewBanner } from "@/components/crew/CrewBanner";
import { AnchorIcon, CompassIcon, FlagIcon, MapIcon, ShipIcon, SkullIcon, SwordsIcon } from "@/components/icons";
import { TopBar } from "@/components/layout/TopBar";
import { CrewMemberCard, EmptyBerth } from "@/components/lobby/CrewMemberCard";
import {
  Badge,
  Button,
  CompassSpinner,
  Divider,
  LoadingScreen,
  Modal,
  Panel,
  ParchmentCard,
  RoomCodeInput,
  Seal,
  Skeleton,
  TextField,
  Tooltip,
  useNotify,
} from "@/components/ui";
import { AVATAR_LIST } from "@/lib/avatars";
import type { AvatarId, PlayerSnapshot } from "@/lib/socket/contract";

const SAMPLE_PLAYERS: PlayerSnapshot[] = [
  { id: "a", name: "Calico Jack", avatarId: "captain", isCaptain: true, isReady: true, isConnected: true, joinedAt: 0 },
  { id: "b", name: "Anne Bonny", avatarId: "quartermaster", isCaptain: false, isReady: false, isConnected: true, joinedAt: 0 },
  { id: "c", name: "Mad Mags", avatarId: "sea-witch", isCaptain: false, isReady: true, isConnected: false, joinedAt: 0 },
];

export default function DesignSystemPage() {
  const { notify } = useNotify();
  const [modalOpen, setModalOpen] = useState(false);
  const [loadingOpen, setLoadingOpen] = useState(false);
  const [text, setText] = useState("");
  const [code, setCode] = useState("K7");
  const [avatar, setAvatar] = useState<AvatarId>("corsair");

  const showLoading = () => {
    setLoadingOpen(true);
    window.setTimeout(() => setLoadingOpen(false), 2500);
  };

  return (
    <main className="min-h-dvh pb-24">
      <TopBar />
      <div className="mx-auto max-w-6xl space-y-12 px-4 pt-6 sm:space-y-16 sm:px-6">
        <header className="text-center">
          <p className="font-ui text-[0.65rem] uppercase tracking-[0.45em] text-brass/80">Design system</p>
          <h1 className="mt-2 font-display text-[clamp(2.5rem,8vw,3.75rem)] leading-tight text-gilded">
            The Shipwright&apos;s Almanac
          </h1>
          <p className="mx-auto mt-3 max-w-xl font-body text-lg italic text-parchment/70">
            Every plank, rivet and inkblot used to build Pirate Protocol.
          </p>
        </header>

        <Section title="Brand">
          <div className="grid items-center gap-10 md:grid-cols-3">
            <Logo size="md" withTagline />
            <CompassRose className="mx-auto w-48 animate-spin-slow" />
            <div className="flex flex-wrap justify-center gap-5 text-brass-light">
              {[SkullIcon, AnchorIcon, CompassIcon, ShipIcon, FlagIcon, SwordsIcon, MapIcon].map((Icon, i) => (
                <Icon key={i} size={32} />
              ))}
            </div>
          </div>
        </Section>

        <Section title="Buttons">
          <div className="flex flex-wrap items-center gap-4">
            <Button>Brass</Button>
            <Button variant="parchment">Parchment</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button loading>Loading</Button>
            <Button disabled>Disabled</Button>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Button size="sm" icon={<FlagIcon size={14} />}>Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
            <Button size="xl">Extra large</Button>
          </div>
        </Section>

        <Section title="Surfaces">
          <div className="grid gap-8 md:grid-cols-2">
            <Panel eyebrow="Wood & brass" title="Panel">
              <p className="font-body text-lg text-parchment/80">
   