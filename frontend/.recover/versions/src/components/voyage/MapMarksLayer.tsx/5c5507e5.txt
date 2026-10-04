"use client";

import { motion } from "framer-motion";
import { useRef, useState } from "react";
import { CHART_H, CHART_W, chartPoint } from "@/lib/game/chart";
import { MARK_LABEL, MARK_LIMITS, fitRoute, routeLength, type MapMark, type MarkKind, type MarkPoint } from "@/lib/socket/marks";

export type MarkTool = MarkKind | "erase";

interface MapMarksLayerProps {
  marks: MapMark[];
  meId: string;
  colorFor: (playerId: string) => string;
  nameFor: (playerId: string) => string;
  tool: MarkTool | null;
  onPlace?: (kind: MarkKind, points: MarkPoint[]) => void;
  onRemove?: (markId: string) => void;
  still: boolean;
}

/** Inverse of chartPoint: chart pixels back to the 0–100 island grid. */
function toGrid(cx: number, cy: number): MarkPoint {
  const clamp = (n: number) => Math.min(100, Math.max(0, n));
  return { x: clamp((cx - 70) / 8.6), y: clamp((cy - 60) / 6.4) };
}

function pathFor(points: readonly MarkPoint[]) {
  return points
    .map((p, i) => {
      const { x, y } = chartPoint(p);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function Stamp({ kind, color }: { kind: Exclude<MarkKind, "route">; color: string }) {
  if (kind === "pin") {
    return (
      <g>
        <path d="M0 0 C-9 -12 -9 -24 0 -24 C9 -24 9 -12 0 0 Z" fill={color} stroke="#1b1208" strokeWidth={1.5} />
        <circle cy={-16} r={3.5} fill="#f4e4c1" />
      </g>
    );
  }
  if (kind === "danger") {
    return (
      <g>
        <path d="M0 -22 L13 2 L-13 2 Z" fill={color} stroke="#1b1208" strokeWidth={1.5} strokeLinejoin="round" />
        <path d="M0 -14 V-5 M0 -1.5 V-1" stroke="#1b1208" strokeWidth={2.6} strokeLinecap="round" />
      </g>
    );
  }
  return (
    <g>
      <circle r={13} fill="none" stroke={color} strokeWidth={1.5} strokeDasharray="3 3" />
      <path d="M-8 -8 L8 8 M8 -8 L-8 8" stroke={color} strokeWidth={4} strokeLinecap="round" />
      <path d="M-8 -8 L8 8 M8 -8 L-8 8" stroke="#1b1208" strokeWidth={1.2} strokeLinecap="round" opacity={0.6} />
    </g>
  );
}

/**
 * The crew's ink on the chart. Lives inside the camera group so marks pan and zoom with the islands;
 * pointer positions are mapped back through the group's own transform.
 */
export function MapMarksLayer({ marks, meId, colorFor, nameFor, tool, onPlace, onRemove, still }: MapMarksLayerProps) {
  const surface = useRef<SVGRectElement>(null);
  const [draft, setDraft] = useState<MarkPoint[] | null>(null);
  const drawing = tool && tool !== "erase";

  const gridAt = (e: React.PointerEvent): MarkPoint | null => {
    const matrix = surface.current?.getScreenCTM();
    const svg = surface.current?.ownerSVGElement;
    if (!matrix || !svg) return null;
    const p = svg.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    const local = p.matrixTransform(matrix.inverse());
    return toGrid(local.x, local.y);
  };

  const onDown = (e: React.PointerEvent<SVGRectElement>) => {
    if (!drawing) return;
    const at = gridAt(e);
    if (!at) return;
    e.preventDefault();
    if (tool === "route") {
      e.currentTarget.setPointerCapture(e.pointerId);
      setDraft([at]);
    } else {
      onPlace?.(tool, [at]);
    }
  };

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    if (!draft) return;
    const at = gridAt(e);
    const last = draft[draft.length - 1];
    if (at && Math.hypot(at.x - last.x, at.y - last.y) > 0.6) setDraft([...draft, at]);
  };

  const onUp = () => {
    if (!draft) return;
    const route = fitRoute(draft);
    setDraft(null);
    if (route.length >= 2 && routeLength(route) >= MARK_LIMITS.minRouteLength) onPlace?.("route", route);
  };

  return (
    <g aria-label="Crew marks">
      {drawing && (
        <rect
          ref={surface}
          x={0}
          y={0}
          width={CHART_W}
          height={CHART_H}
          fill="transparent"
          style={{ cursor: "crosshair", touchAction: "none" }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={() => setDraft(null)}
        />
      )}

      {marks.map((mark) => {
        const color = colorFor(mark.playerId);
        const mine = mark.playerId === meId;
        const erasable = tool === "erase" && mine && !!onRemove;
        const label = `${MARK_LABEL[mark.kind]} by ${nameFor(mark.playerId)}${erasable ? ". Press to erase." : ""}`;
        const interaction = erasable
          ? {
              role: "button",
              tabIndex: 0,
              "aria-label": label,
              style: { cursor: "pointer" },
              onClick: () => onRemove(mark.id),
              onKeyDown: (e: React.KeyboardEvent) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onRemove(mark.id);
                }
              },
            }
          : { style: { pointerEvents: "none" as const } };

        if (mark.kind === "route") {
          return (
            <g key={mark.id} {...interaction}>
              <title>{label}</title>
              {erasable && <path d={pathFor(mark.points)} stroke="transparent" strokeWidth={18} fill="none" />}
              <motion.path
                d={pathFor(mark.points)}
                fill="none"
                stroke={color}
                strokeWidth={3}
                strokeDasharray="8 6"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={still ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                opacity={0.9}
              />
            </g>
          );
        }
        const { x, y } = chartPoint(mark.points[0]);
        return (
          <g key={mark.id} transform={`translate(${x} ${y})`} {...interaction}>
            <title>{label}</title>
            <motion.g
              initial={still ? false : { scale: 0, y: -16, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 420, damping: 22 }}
            >
              <Stamp kind={mark.kind} color={color} />
            </motion.g>
            {erasable && <circle r={16} cy={-8} fill="none" stroke="#f4e4c1" strokeWidth={1.2} strokeDasharray="2 3" />}
          </g>
        );
      })}

      {draft && draft.length > 1 && (
        <path
          d={pathFor(draft)}
          fill="none"
          stroke={colorFor(meId)}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.6}
          style={{ pointerEvents: "none" }}
        />
      )}
    </g>
  );
}
