import {
  CartesianGrid,
  Line,
  ReferenceLine,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts";
import { SALAMANCA_BARRIOS } from "@/data/salamanca";
import type { ViviendaCandidata } from "@/store/types";
import { formatEUR, formatEurPerM2, formatM2 } from "@/ui/format";

function linearRegression(points: { x: number; y: number }[]): { slope: number; intercept: number } | null {
  const n = points.length;
  if (n < 2) return null;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumXX = points.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumXX - sumX * sumX;
  if (Math.abs(denom) < 1e-9) return null;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

function tickEur(v: number): string {
  if (Math.abs(v) >= 1000) return `${Math.round(v / 1000)}k €`;
  return `${Math.round(v)} €`;
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div
      className="rounded border px-3 py-2 text-xs shadow-lg"
      style={{ background: "var(--surface-raised)", borderColor: "var(--border-strong)", color: "var(--text)" }}
    >
      <div className="font-medium" style={{ color: "var(--text)" }}>
        {d.nombre}
      </div>
      <div style={{ color: "var(--text-secondary)" }}>
        {formatM2(d.x)} construidos ({formatM2(d.metrosUtiles)} útiles) · {formatEUR(d.y)} · {formatEurPerM2(d.precioM2)}
      </div>
      {d.barrioNombre && (
        <div style={{ color: "var(--text-muted)" }}>
          {d.barrioNombre}
          {d.diferenciaPct !== null && (
            <span style={{ color: d.diferenciaPct > 0 ? "var(--critical)" : "var(--good)" }}>
              {" "}
              ({d.diferenciaPct > 0 ? "+" : ""}
              {(d.diferenciaPct * 100).toFixed(1)}% vs barrio)
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function PriceScatter({ viviendas }: { viviendas: ViviendaCandidata[] }) {
  const data = viviendas.map((v) => {
    const barrio = v.barrioId ? SALAMANCA_BARRIOS.find((b) => b.id === v.barrioId) : undefined;
    const precioM2 = v.precio / v.metrosConstruidos;
    const diferenciaPct = barrio ? (precioM2 - barrio.precioVentaM2) / barrio.precioVentaM2 : null;
    return {
      nombre: v.nombre,
      x: v.metrosConstruidos,
      metrosUtiles: v.metrosUtiles,
      y: v.precio,
      precioM2,
      barrioNombre: barrio?.nombre ?? null,
      diferenciaPct,
    };
  });

  const maxM2 = Math.max(...data.map((d) => d.x), 50) * 1.15;
  const regression = linearRegression(data.map((d) => ({ x: d.x, y: d.y })));
  const regressionLine = regression
    ? [
        { x: 0, y: regression.intercept },
        { x: maxM2, y: regression.intercept + regression.slope * maxM2 },
      ]
    : null;

  const barriosPresentes = [...new Set(viviendas.map((v) => v.barrioId).filter(Boolean))]
    .map((id) => SALAMANCA_BARRIOS.find((b) => b.id === id))
    .filter((b): b is (typeof SALAMANCA_BARRIOS)[number] => Boolean(b));

  return (
    <ResponsiveContainer width="100%" height={360}>
      <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 24 }}>
        <CartesianGrid stroke="var(--border)" />
        <XAxis
          type="number"
          dataKey="x"
          name="Superficie construida"
          domain={[0, maxM2]}
          tickFormatter={(v) => `${Math.round(v)} m²`}
          tick={{ fill: "var(--text-muted)", fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: "var(--border-strong)" }}
          label={{
            value: "m² construidos",
            position: "insideBottom",
            offset: -14,
            fill: "var(--text-muted)",
            fontSize: 11,
          }}
        />
        <YAxis
          type="number"
          dataKey="y"
          name="Precio"
          tickFormatter={tickEur}
          tick={{ fill: "var(--text-muted)", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={56}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: "3 3", stroke: "var(--border-strong)" }} />

        {barriosPresentes.map((b) => (
          <ReferenceLine
            key={b.id}
            stroke="var(--text-muted)"
            strokeDasharray="2 3"
            segment={[
              { x: 0, y: 0 },
              { x: maxM2, y: maxM2 * b.precioVentaM2 },
            ]}
            label={{ value: b.nombre, position: "insideTopRight", fill: "var(--text-muted)", fontSize: 10 }}
          />
        ))}

        {regressionLine && (
          <Line
            data={regressionLine}
            dataKey="y"
            xAxisId={0}
            stroke="var(--series-4)"
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={false}
            legendType="none"
            isAnimationActive={false}
          />
        )}

        <Scatter data={data} fill="var(--series-1)" />
      </ScatterChart>
    </ResponsiveContainer>
  );
}
