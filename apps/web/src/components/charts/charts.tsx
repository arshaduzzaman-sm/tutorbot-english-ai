import type { ReactNode } from "react";

/**
 * Small dependency-free SVG charts. Each chart is a figure with a caption, a text summary for screen readers
 * (role="img" + aria-label) and a data table the viewer can open, so no information is only in the picture.
 */

export type Point = { label: string; value: number | null };

const W = 640;
const H = 220;
const PAD = { top: 12, right: 12, bottom: 28, left: 36 };

function Frame({ id, title, desc, summary, table, children }: {
  id: string; title: string; desc?: string; summary: string; table: ReactNode; children: ReactNode;
}) {
  return (
    <figure className="space-y-2" aria-labelledby={`${id}-title`} data-testid={`chart-${id}`}>
      <figcaption>
        <h3 id={`${id}-title`} className="font-semibold text-primary">{title}</h3>
        {desc && <p className="text-sm text-muted-foreground">{desc}</p>}
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary} className="h-auto w-full">
        {children}
      </svg>
      {table}
    </figure>
  );
}

function Axes({ max, unit }: { max: number; unit: string }) {
  const ticks = [0, max / 2, max];
  const innerH = H - PAD.top - PAD.bottom;
  return (
    <g aria-hidden="true">
      {ticks.map((t) => {
        const y = PAD.top + innerH - (t / max) * innerH;
        return (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} className="stroke-border" strokeWidth={1} />
            <text x={PAD.left - 6} y={y + 4} textAnchor="end" className="fill-muted-foreground text-[11px]">
              {Math.round(t)}{unit}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function xLabels(points: Point[], x: (i: number) => number) {
  const every = Math.max(1, Math.ceil(points.length / 8));
  return points.map((p, i) =>
    i % every === 0 || i === points.length - 1 ? (
      <text key={p.label} x={x(i)} y={H - 8} textAnchor="middle" className="fill-muted-foreground text-[11px]" aria-hidden="true">
        {p.label}
      </text>
    ) : null,
  );
}

export function LineChart({ id, title, desc, points, max = 100, unit = "%", summary, table }: {
  id: string; title: string; desc?: string; points: Point[]; max?: number; unit?: string; summary: string; table: ReactNode;
}) {
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (Math.min(v, max) / max) * innerH;
  // Break the line at days with no data instead of inventing values
  const segments: string[] = [];
  let current = "";
  points.forEach((p, i) => {
    if (p.value == null) {
      if (current) segments.push(current);
      current = "";
      return;
    }
    current += `${current ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`;
  });
  if (current) segments.push(current);
  return (
    <Frame id={id} title={title} desc={desc} summary={summary} table={table}>
      <Axes max={max} unit={unit} />
      {segments.map((d) => <path key={d} d={d} className="fill-none stroke-accent-blue" strokeWidth={2.5} />)}
      {points.map((p, i) => p.value != null && (
        <circle key={p.label} cx={x(i)} cy={y(p.value)} r={3.5} className="fill-accent-blue" />
      ))}
      {xLabels(points, x)}
    </Frame>
  );
}

export function BarChart({ id, title, desc, points, max, unit = "", summary, table }: {
  id: string; title: string; desc?: string; points: Point[]; max?: number; unit?: string; summary: string; table: ReactNode;
}) {
  const top = max ?? Math.max(1, ...points.map((p) => p.value ?? 0));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const band = innerW / Math.max(1, points.length);
  const x = (i: number) => PAD.left + band * i + band / 2;
  return (
    <Frame id={id} title={title} desc={desc} summary={summary} table={table}>
      <Axes max={top} unit={unit} />
      {points.map((p, i) => {
        const h = ((p.value ?? 0) / top) * innerH;
        return (
          <rect key={p.label} x={x(i) - band * 0.35} width={band * 0.7} y={PAD.top + innerH - h} height={h} rx={2}
            className="fill-accent-purple" />
        );
      })}
      {xLabels(points, x)}
    </Frame>
  );
}

/** Horizontal bars with the label and value written next to each bar (readable without colour). */
export function HBarChart({ id, title, desc, rows, summary, table }: {
  id: string; title: string; desc?: string; rows: { label: string; value: number | null; note?: string }[]; summary: string; table: ReactNode;
}) {
  return (
    <figure className="space-y-2" aria-labelledby={`${id}-title`} data-testid={`chart-${id}`}>
      <figcaption>
        <h3 id={`${id}-title`} className="font-semibold text-primary">{title}</h3>
        {desc && <p className="text-sm text-muted-foreground">{desc}</p>}
      </figcaption>
      <div role="img" aria-label={summary} className="space-y-2">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[minmax(0,10rem)_1fr_3rem] items-center gap-2 text-sm" aria-hidden="true">
            <span className="truncate text-foreground">{r.label}</span>
            <span className="h-3 rounded-full bg-muted">
              <span className="block h-3 rounded-full bg-accent-blue" style={{ width: `${r.value ?? 0}%` }} />
            </span>
            <span className="text-right tabular-nums text-foreground">{r.value == null ? "—" : `${r.value}%`}</span>
          </div>
        ))}
      </div>
      {table}
    </figure>
  );
}

export function DataTable({ summary, caption, head, rows }: {
  summary: string; caption: string; head: string[]; rows: (string | number)[][];
}) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-medium text-accent-blue underline">{summary}</summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>{head.map((h) => <th key={h} scope="col" className="border-b border-border px-2 py-1 font-semibold text-primary">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r[0])}>
                {r.map((c, i) => i === 0
                  ? <th key={i} scope="row" className="border-b border-border px-2 py-1 font-normal text-foreground">{c}</th>
                  : <td key={i} className="border-b border-border px-2 py-1 tabular-nums text-foreground">{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
