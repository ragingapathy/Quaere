"use client";

type Point = { x: number; audience: number | null; claimant: number | null; label: string };

export function ChartSVG({
  points,
  claimantName,
}: {
  points: Point[];
  claimantName: string;
}) {
  const y = (v: number) => 150 - v * 1.3;

  function line(key: "claimant" | "audience", color: string, dashed: boolean) {
    const pts = points.filter((p) => p[key] != null) as (Point & { [k: string]: number })[];
    if (pts.length === 0) return null;
    const polyPoints = pts.map((p) => `${p.x},${y(p[key] as number)}`).join(" ");
    return (
      <g>
        <polyline
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeDasharray={dashed ? "5 4" : undefined}
          points={polyPoints}
        />
        {pts.map((p) => (
          <g key={`${key}-${p.label}`}>
            <circle cx={p.x} cy={y(p[key] as number)} r={4.5} fill={color} />
            <text x={p.x + 8} y={y(p[key] as number) - 6} fontSize={11} fill={color}>
              {Math.round(p[key] as number)}
            </text>
          </g>
        ))}
      </g>
    );
  }

  return (
    <>
      <svg
        className="chart"
        viewBox="0 0 320 180"
        role="img"
        aria-label="Claimant certainty versus audience certainty by round"
      >
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line x1={30} x2={310} y1={y(v)} y2={y(v)} stroke="var(--rule)" />
            <text x={4} y={y(v) + 4} fontSize={10} fill="var(--muted)">
              {v}%
            </text>
          </g>
        ))}
        {line("claimant", "var(--ink)", true)}
        {line("audience", "var(--green)", false)}
        {points.map((p) => (
          <text key={p.label} x={p.x} y={172} fontSize={11} fill="var(--muted)" textAnchor="middle">
            {p.label}
          </text>
        ))}
      </svg>
      <p className="tiny muted">
        <span style={{ color: "var(--ink)" }}>Dashed: {claimantName}&rsquo;s committed certainty.</span>{" "}
        <span style={{ color: "var(--green)" }}>Solid: audience.</span>
      </p>
    </>
  );
}
