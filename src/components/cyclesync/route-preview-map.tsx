"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import { cn } from "@/lib/utils";

import "leaflet/dist/leaflet.css";

const ROUTE_COLOR = "#0d9488";

type Props = {
  positions: [number, number][];
  className?: string;
};

export default function RoutePreviewMap({ positions, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || positions.length < 2) return;

    const map = L.map(el, {
      scrollWheelZoom: true,
      attributionControl: true,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    const line = L.polyline(positions, {
      color: ROUTE_COLOR,
      weight: 4,
      opacity: 0.92,
    }).addTo(map);

    map.fitBounds(line.getBounds(), { padding: [20, 20], maxZoom: 16 });

    return () => {
      map.remove();
    };
  }, [positions]);

  return (
    <div className={cn("relative isolate h-56 w-full min-h-[220px] overflow-hidden rounded-xl bg-muted ring-1 ring-border/60", className)}>
      <div
        ref={containerRef}
        className="absolute inset-0 z-10 size-full [&_.leaflet-control-attribution]:text-[10px]"
        aria-label="Route preview map"
        role="region"
      />
    </div>
  );
}
