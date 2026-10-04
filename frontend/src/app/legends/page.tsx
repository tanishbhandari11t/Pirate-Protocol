"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { SeaConditionBadge } from "@/components/atmosphere/SeaCondition";
import { PirateAvatar } from "@/components/avatar/PirateAvatar";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { seaForecast } from "@/lib/game/calendar";
import { CHART_H, CHART_W, SAILOR_COLORS, chartPoint } from "@/lib/game/chart";
import { formatVoyageClock } from "@/lib/game/captainsLog";
import { legendStore, useLegends, type Legend } from "@/lib/game/legends";

const VERDICT: Record<string, string> = {
  treasure: "Found the hoard",
  time: "Beaten by the tide",
  wreck: "Lost to the deep",
};

const noop = () => () => {};
const useNow = () => useSyncExternalStore(noop, () => Math.floor(Date.now() / 60_000) * 60_000, () => 0);

function MiniChart({ legend }: { legend: Legend }) {
  return (
    <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="block h-auto w-full rounded bg-[#d9c28e]/40" role="img" aria-label={`The routes sailed by ${legend.crewName}`}>
      {legend.discoveries.map((d, i) => {
        const p = chartPoint(d.at);
        return <circle key={i} cx={p.x} cy={p.y} r={14} fill="#8a6a3a" opacity={0.35} />;
      })}
      {legend.sailors.map((s, i) => {
        const pts = s.route.map(chartPoint);
        if (pts.length < 2) return null;
        return (
          <polyline
            key={s.id}
            points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke={SAILOR_COLORS[i % SAILOR_COLORS.length]}
            strokeWidth={s.won ? 7 : 4}
            strokeDasharray={s.won ? undefined : "14 10"}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      })}
      {legend.wrecks.map((w, i) => {
        const p = chartPoint(w.at);
        return (
          <text key={i} x={p.x} y={p.y + 10} textAnchor="middle" fontSize={34}>
            ☠
          </text>
        );
      })}
    </svg>
  );
}

function Monument({ legend, index }: { legend: Legend; index: number }) {
  const date = new Date(legend.finishedAt);
  return (
    <motion.li
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.06 }}
      className="parchment rounded-lg p-4 text-ink"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-2xl uppercase tracking-wider">{legend.crewName}</h2>
        <time dateTime={date.toISOString()} className="font-ui text-[0.6rem] uppercase tracking-[0.2em] text-ink-soft/80">
          {date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
        </time>
      </div>
      <p className="font-body italic text-ink-soft">
        {legend.reason ? VERDICT[legend.reason] ?? "The voyage ended" : "The voyage ended"}
        {legend.winnerName && ` · ${legend.winnerName} claimed the treasure`} · {formatVoyageClock(legend.durationMs)} at sea
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_14rem]">
        <MiniChart legend={legend} />
        <div className="space-y-2">
          <ul className="flex flex-wrap gap-2">
            {legend.sailors.map((s) => (
              <li key={s.id} className="flex items-center gap-1.5" title={s.won ? "Victor" : s.wrecked ? "Claimed by the sea" : "Sailed home"}>
                <PirateAvatar avatarId={s.avatarId} className={cn("h-8 w-8", s.wrecked && "grayscale")} />
                <span className="font-body text-sm">
                  {s.name}
                  {s.won && " 👑"}
                  {s.wrecked && " ☠"}
                </span>
              </li>
            ))}
          </ul>
          <dl className="grid grid-cols-2 gap-1 font-ui text-[0.6rem] uppercase tracking-[0.15em] text-ink-soft">
            <dt>Charted</dt>
            <dd className="text-right text-ink">
              {legend.islandsCharted}/{legend.islandsTotal}
            </dd>
            <dt>Riddles</dt>
            <dd className="text-right text-ink">{legend.riddlesSolved}</dd>
          </dl>
          {legend.discoveries.length > 0 && (
            <p className="font-body text-sm text-ink-soft">
              First sightings:{" "}
              {legend.discoveries
                .slice(0, 4)
                .map((d) => `${d.islandName} (${d.by})`)
                .join(", ")}
              {legend.discoveries.length > 4 && "…"}
            </p>
          )}
          {legend.wrecks.length > 0 && (
            <p className="font-body text-sm text-blood">
              Wrecks: {legend.wrecks.map((w) => `${w.name} off ${w.islandName}`).join(", ")}
            </p>
          )}
        </div>
      </div>
    </motion.li>
  );
}

/** The Hall of Legends: every voyage this device finished, plus the Seven Seas Calendar. */
export default function LegendsPage() {
  const legends = useLegends();
  const now = useNow();
  const [confirm, setConfirm] = useState(false);
  const forecast = now ? seaForecast(now) : [];

  return (
    <main className="flex min-h-dvh flex-col" id="main">
      <TopBar>
        <SeaConditionBadge compact />
      </TopBar>
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16 sm:px-6">
        <header className="py-8 text-center">
          <p className="font-ui text-[0.6rem] uppercase tracking-[0.45em] text-brass/80">The world remembers</p>
          <h1 className="mt-2 font-display text-[clamp(2.5rem,7vw,4rem)] leading-tight text-gilded">Hall of Legends</h1>
          <p className="mx-auto mt-2 max-w-xl font-body text-lg italic text-parchment/75">
            Every voyage you finish is carved here, routes and wrecks and all. On a Ghost Moon, these crews sail your charts again.
          </p>
        </header>

        <section id="calendar" aria-labelledby="calendar-title" className="wood-panel mb-10 rounded-lg p-4">
          <h2 id="calendar-title" className="font-display text-2xl text-gold">
            The Seven Seas Calendar
          </h2>
          <p className="font-body text-sm italic text-parchment/70">One condition rules the seas each day, the same for every crew.</p>
          <ol className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {forecast.map(({ day, date, condition }, i) => (
              <li
                key={day}
                className={cn("rounded border px-2 py-2 text-center", i === 0 ? "border-gold/70 bg-gold/10" : "border-brass/25 bg-abyss/40")}
                title={condition.effect}
              >
                <p className="font-ui text-[0.55rem] uppercase tracking-[0.2em] text-brass/70">
                  {i === 0 ? "Today" : date.toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" })}
                </p>
                <p className="mt-1 text-2xl" aria-hidden>
                  {condition.glyph}
                </p>
                <p className="font-display text-sm text-parchment">{condition.name}</p>
              </li>
            ))}
          </ol>
          {forecast[0] && <p className="mt-3 font-body text-parchment/80">Today: {forecast[0].condition.effect}</p>}
        </section>

        {legends.length === 0 ? (
          <div className="py-16 text-center">
            <p className="font-body text-xl italic text-parchment/70">No legends yet. Finish a voyage and your crew will be remembered here.</p>
            <Link href="/crew/create" className="mt-4 inline-block font-ui text-xs uppercase tracking-[0.3em] text-gold underline-offset-4 hover:underline">
              Raise your colours
            </Link>
          </div>
        ) : (
          <>
            <ol className="space-y-5">
              {legends.map((legend, i) => (
                <Monument key={legend.id} legend={legend} index={i} />
              ))}
            </ol>
            <div className="mt-8 text-center">
              {confirm ? (
                <div className="inline-flex gap-2">
                  <Button variant="ghost" onClick={() => setConfirm(false)}>
                    Keep them
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => {
                      legendStore.clear();
                      setConfirm(false);
                    }}
                  >
                    Erase every legend
                  </Button>
                </div>
              ) : (
                <Button variant="ghost" onClick={() => setConfirm(true)}>
                  Forget these legends
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
