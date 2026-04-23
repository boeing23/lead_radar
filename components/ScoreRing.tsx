"use client";

import { useEffect, useState } from "react";
import type { ScoreBreakdown } from "@/lib/types";

// Score ring with count-up animation. Uses a conic-gradient-less pure-SVG
// approach so it renders cleanly on screen recordings at any zoom.

const TIER_COLOR: Record<ScoreBreakdown["tier"], string> = {
  hot: "#dc2626",
  warm: "#c2410c",
  nurture: "#a16207",
  park: "#525252",
};

interface Props {
  score: ScoreBreakdown;
  size?: number;
  strokeWidth?: number;
}

export function ScoreRing({ score, size = 96, strokeWidth = 8 }: Props) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    // Count-up animation — short, not flashy.
    const start = performance.now();
    const dur = 420;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      // ease-out-quad
      const eased = 1 - (1 - p) * (1 - p);
      setDisplay(Math.round(score.total * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score.total]);

  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const filled = circ * (display / 100);
  const color = TIER_COLOR[score.tier];

  return (
    <div className="relative inline-block" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--ink-200)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circ}`}
          style={{ transition: "stroke-dasharray 120ms ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="num text-2xl font-semibold tracking-tight" style={{ color: "var(--ink-950)" }}>
          {display}
        </span>
        <span
          className="label"
          style={{ color, fontSize: 9 }}
        >
          {score.tier}
        </span>
      </div>
    </div>
  );
}
