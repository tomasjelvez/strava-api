"use client";

import { useId, useMemo } from "react";
import { formatDistanceMeters, formatElevation } from "@/lib/format-strava-metrics";
import { cn } from "@/lib/utils";

type Props = {
  distanceM: number[];
  altitudeM: number[];
  className?: string;
};

const VB_W = 1000;
const VB_H = 200;
const PAD_L = 6;
const PAD_R = 6;
const PAD_T = 14;
const PAD_B = 28;

export function RouteElevationProfile({
  distanceM,
  altitudeM,
  className,
}: Props) {
  const gradId = useId().replace(/:/g, "");

  const chart = useMemo(() => {
    const n = Math.min(distanceM.length, altitudeM.length);
    if (n < 2) return null;

    const d0 = distanceM[0] ?? 0;
    const dEnd = distanceM[n - 1] ?? d0;
    const span = Math.max(dEnd - d0, 1);
    const dMid = d0 + span / 2;

    let aMin = altitudeM[0]!;
    let aMax = altitudeM[0]!;
    for (let i = 1; i < n; i++) {
      const a = altitudeM[i]!;
      if (a < aMin) aMin = a;
      if (a > aMax) aMax = a;
    }
    const aRange = Math.max(aMax - aMin, 5);

    const plotW = VB_W - PAD_L - PAD_R;
    const plotH = VB_H - PAD_T - PAD_B;

    const coords: { x: number; y: number }[] = [];
    for (let i = 0; i < n; i++) {
      const t = (distanceM[i]! - d0) / span;
      const x = PAD_L + t * plotW;
      const rel = (altitudeM[i]! - aMin) / aRange;
      const y = PAD_T + plotH - rel * plotH;
      coords.push({ x, y });
    }

    const linePoints = coords.map((c) => `${c.x.toFixed(2)},${c.y.toFixed(2)}`).join(" ");
    const baseY = VB_H - PAD_B;
    let fillPath = `M ${coords[0]!.x.toFixed(2)} ${baseY}`;
    for (const c of coords) {
      fillPath += ` L ${c.x.toFixed(2)},${c.y.toFixed(2)}`;
    }
    fillPath += ` L ${coords[n - 1]!.x.toFixed(2)} ${baseY} Z`;

    return {
      linePoints,
      fillPath,
      dEnd,
      dMid,
      aMin,
      aMax,
    };
  }, [distanceM, altitudeM]);

  if (!chart) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-xs font-medium text-muted-foreground">Altimetría</p>
      <div className="rounded-xl border bg-card/80 ring-1 ring-border/50">
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="block h-36 w-full text-muted-foreground sm:h-44"
          preserveAspectRatio="none"
          role="img"
          aria-label="Perfil de elevación de la ruta según distancia"
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(13 148 136 / 0.35)" />
              <stop offset="100%" stopColor="rgb(13 148 136 / 0.04)" />
            </linearGradient>
          </defs>
          <path d={chart.fillPath} fill={`url(#${gradId})`} />
          <polyline
            fill="none"
            stroke="rgb(13 148 136)"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={chart.linePoints}
            vectorEffect="non-scaling-stroke"
          />
          <text
            x={PAD_L}
            y={VB_H - 6}
            fill="currentColor"
            className="text-muted-foreground"
            fontSize={11}
          >
            0
          </text>
          <text
            x={VB_W / 2}
            y={VB_H - 6}
            textAnchor="middle"
            fill="currentColor"
            className="text-muted-foreground"
            fontSize={11}
          >
            {formatDistanceMeters(chart.dMid)}
          </text>
          <text
            x={VB_W - PAD_R}
            y={VB_H - 6}
            textAnchor="end"
            fill="currentColor"
            className="text-muted-foreground"
            fontSize={11}
          >
            {formatDistanceMeters(chart.dEnd)}
          </text>
          <text
            x={PAD_L + 2}
            y={PAD_T - 2}
            fill="currentColor"
            className="text-muted-foreground"
            fontSize={11}
          >
            {formatElevation(chart.aMax)}
          </text>
          <text
            x={PAD_L + 2}
            y={VB_H - PAD_B - 4}
            fill="currentColor"
            className="text-muted-foreground"
            fontSize={11}
          >
            {formatElevation(chart.aMin)}
          </text>
        </svg>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Eje horizontal: distancia acumulada · eje vertical: elevación (m)
      </p>
    </div>
  );
}
