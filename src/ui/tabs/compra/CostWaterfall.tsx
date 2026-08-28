import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PartidaCoste } from "@/core/spain/costs";
import { formatEUR } from "@/ui/format";

const COLORS = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
  "var(--series-7)",
];

function tickEur(v: number): string {
  if (Math.abs(v) >= 1000) return `${Math.round(v / 1000)}k €`;
  return `${Math.round(v)} €`;
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload.find((p: any) => p.dataKey === "importe");
  if (!p) return null;
  return (
    <div
      className="rounded border px-3 py-2 text-xs shadow-lg"
      style={{ background: "var(--surface-raised)", borderColor: "var(--border-strong)", color: "var(--text)" }}
    >
      <div style={{ color: "var(--text-secondary)" }}>{p.payload.concepto}</div>
      <div className="tabular-nums font-medium">{formatEUR(p.payload.importe, 2)}</div>
    </div>
  );
}

/** A waterfall built from a stacked bar chart: an invisible "base" bar carries each segment's running total. */
export function CostWaterfall({ partidas }: { partidas: PartidaCoste[] }) {
  let acumulado = 0;
  const data = partidas.map((p, i) => {
    const base = acumulado;
    acumulado += p.importe;
    return { concepto: p.concepto, base, importe: p.importe, color: COLORS[i % COLORS.length] };
  });

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 20, right: 8, left: 0, bottom: 48 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="concepto"
          tick={{ fill: "var(--text-muted)", fontSize: 10 }}
          tickLine={false}
          axisLine={{ stroke: "var(--border-strong)" }}
          interval={0}
          angle={-25}
          textAnchor="end"
          height={70}
        />
        <YAxis
          tickFormatter={tickEur}
          tick={{ fill: "var(--text-muted)", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={56}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--surface-raised)" }} />
        <Bar dataKey="base" stackId="w" fill="transparent" />
        <Bar dataKey="importe" stackId="w" radius={[2, 2, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.color} />
          ))}
          <LabelList
            dataKey="importe"
            position="top"
            formatter={(v: unknown) => formatEUR(Number(v), 0)}
            style={{ fill: "var(--text-secondary)", fontSize: 10 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
