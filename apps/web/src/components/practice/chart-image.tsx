/** Draws a Describe Image chart from data (bar, line or pie), with a data table for screen readers. */
type Datum = { label: string; value: number };
export type ChartSpec = { kind: string; title: string; data: Datum[]; unit?: string };

const COLORS = ["#1d4ed8", "#0f766e", "#b45309", "#7c3aed", "#be123c", "#4d7c0f"];

export function ChartImage({ chart }: { chart: ChartSpec }) {
  const max = Math.max(...chart.data.map((d) => d.value), 1);
  const total = chart.data.reduce((a, d) => a + d.value, 0) || 1;
  let angle = 0;
  return (
    <figure className="rounded-xl border border-border bg-white p-4" data-testid="chart-image">
      <figcaption className="mb-2 font-semibold">{chart.title}</figcaption>
      <svg viewBox="0 0 320 200" role="img" aria-label={chart.title} className="w-full max-w-md">
        {chart.kind === "pie_chart"
          ? chart.data.map((d, i) => {
              const a0 = angle, a1 = angle + (d.value / total) * Math.PI * 2;
              angle = a1;
              const [x0, y0, x1, y1] = [100 + 80 * Math.sin(a0), 100 - 80 * Math.cos(a0), 100 + 80 * Math.sin(a1), 100 - 80 * Math.cos(a1)];
              return (
                <g key={d.label}>
                  <path d={`M100,100 L${x0},${y0} A80,80 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1},${y1} Z`} fill={COLORS[i % COLORS.length]} />
                  <rect x={200} y={20 + i * 22} width={12} height={12} fill={COLORS[i % COLORS.length]} />
                  <text x={218} y={31 + i * 22} fontSize="12">{d.label} ({d.value}%)</text>
                </g>
              );
            })
          : chart.kind === "line_chart"
            ? (
              <polyline fill="none" stroke={COLORS[0]} strokeWidth={3}
                points={chart.data.map((d, i) => `${30 + (i * 270) / Math.max(chart.data.length - 1, 1)},${170 - (d.value / max) * 150}`).join(" ")} />
            )
            : chart.data.map((d, i) => {
                const w = 260 / chart.data.length;
                const h = (d.value / max) * 150;
                return (
                  <g key={d.label}>
                    <rect x={40 + i * w + 6} y={170 - h} width={w - 12} height={h} fill={COLORS[0]} />
                    <text x={40 + i * w + w / 2} y={186} fontSize="11" textAnchor="middle">{d.label}</text>
                    <text x={40 + i * w + w / 2} y={165 - h} fontSize="11" textAnchor="middle">{d.value}</text>
                  </g>
                );
              })}
      </svg>
      <table className="sr-only">
        <caption>{chart.title}</caption>
        <tbody>{chart.data.map((d) => <tr key={d.label}><th scope="row">{d.label}</th><td>{d.value}{chart.unit ?? ""}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}
