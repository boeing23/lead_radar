import type { ScoreBreakdown } from "@/lib/types";

// Radar / spider chart showing the shape of a lead across 4 axes.
// Custom SVG — no chart library needed, keeps the bundle small and predictable.
//
// Layout: the drawable chart fits inside a square of `size`, but the SVG
// viewBox is `size + 2·labelPad` wide/tall so that labels around the
// perimeter never clip. The chart is drawn in the center of that padded box.

interface Props {
  score: ScoreBreakdown;
  size?: number;
}

const AXIS = [
  { key: "fit",      short: "FIT",  angle: -Math.PI / 2 },
  { key: "pressure", short: "PRES", angle: 0 },
  { key: "timing",   short: "TIME", angle: Math.PI / 2 },
  { key: "persona",  short: "PERS", angle: Math.PI },
] as const;

export function RadarChart({ score, size = 160 }: Props) {
  const labelPad = 28;              // breathing room outside the chart
  const box = size + labelPad * 2;  // full SVG dimensions
  const cx = box / 2;
  const cy = box / 2;
  const max = size / 2;

  const axes = AXIS.map((a) => {
    const value = score[a.key].value;
    return { ...a, value };
  });

  const rings = [0.25, 0.5, 0.75, 1];

  const points = axes.map((a) => {
    const r = (a.value / 100) * max;
    return { x: cx + Math.cos(a.angle) * r, y: cy + Math.sin(a.angle) * r };
  });
  const poly = points.map((p) => `${p.x},${p.y}`).join(" ");

  // Label placement: position each label a consistent distance outside the
  // outer ring, aligned away from the axis so it visually "points" inward.
  const labelDist = max + 12;
  const labels = axes.map((a) => {
    const lx = cx + Math.cos(a.angle) * labelDist;
    const ly = cy + Math.sin(a.angle) * labelDist;
    let anchor: "start" | "middle" | "end" = "middle";
    if (Math.abs(Math.cos(a.angle)) > 0.5) anchor = Math.cos(a.angle) > 0 ? "start" : "end";
    return { ...a, lx, ly, anchor };
  });

  return (
    <svg
      width={box}
      height={box}
      viewBox={`0 0 ${box} ${box}`}
      className="animate-fade-in block"
    >
      {/* Rings */}
      {rings.map((r, i) => (
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r={r * max}
          fill="none"
          stroke="#e5e5e5"
          strokeDasharray={i === rings.length - 1 ? "none" : "2 3"}
          strokeWidth={1}
        />
      ))}
      {/* Axis lines */}
      {axes.map((a, i) => (
        <line
          key={i}
          x1={cx}
          y1={cy}
          x2={cx + Math.cos(a.angle) * max}
          y2={cy + Math.sin(a.angle) * max}
          stroke="#e5e5e5"
          strokeWidth={1}
        />
      ))}
      {/* Filled shape */}
      <polygon
        points={poly}
        fill="#0a0a0a"
        fillOpacity={0.08}
        stroke="#0a0a0a"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      {/* Point dots */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="#0a0a0a" />
      ))}
      {/* Labels — short name on top, value on a second line */}
      {labels.map((l, i) => (
        <text
          key={i}
          x={l.lx}
          y={l.ly}
          textAnchor={l.anchor}
          dominantBaseline="middle"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          <tspan
            x={l.lx}
            dy="-0.4em"
            fontSize={9}
            fontWeight={600}
            fill="#737373"
            style={{ letterSpacing: "0.08em" }}
          >
            {l.short}
          </tspan>
          <tspan
            x={l.lx}
            dy="1.25em"
            fontSize={10}
            fontFamily="var(--font-mono)"
            fill="#0a0a0a"
          >
            {Math.round(l.value)}
          </tspan>
        </text>
      ))}
    </svg>
  );
}
