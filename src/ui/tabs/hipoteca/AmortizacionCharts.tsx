import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ScheduleRow } from "@/core/schedule";
import { Card } from "@/ui/components/Card";
import { formatEUR, formatMonths } from "@/ui/format";

function tickEur(v: number): string {
  if (Math.abs(v) >= 1000) return `${Math.round(v / 1000)}k €`;
  return `${Math.round(v)} €`;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded border px-3 py-2 text-xs shadow-lg"
      style={{ background: "var(--surface-raised)", borderColor: "var(--border-strong)", color: "var(--text)" }}
    >
      <div className="mb-1 font-medium" style={{ color: "var(--text-secondary)" }}>
        Mes {label}
      </div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="tabular-nums flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span style={{ color: "var(--text-secondary)" }}>{p.name}:</span>
          <span className="font-medium">{formatEUR(p.value, 2)}</span>
        </div>
      ))}
    </div>
  );
}

export function AmortizacionCharts({ filas, mesCruce }: { filas: ScheduleRow[]; mesCruce: number | null }) {
  const data = filas.map((f) => ({
    mes: f.n,
    Principal: f.principal,
    Interés: f.interes,
    Saldo: f.saldoFinal,
  }));

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Card
        title="Composición de la cuota"
        subtitle="Cuánto de cada pago va a principal frente a intereses, mes a mes"
      >
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="mes"
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "var(--border-strong)" }}
              label={{ value: "Mes", position: "insideBottom", offset: -2, fill: "var(--text-muted)", fontSize: 11 }}
            />
            <YAxis
              tickFormatter={tickEur}
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={56}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12, color: "var(--text-secondary)" }} />
            <Area
              type="monotone"
              dataKey="Principal"
              stackId="cuota"
              stroke="var(--series-1)"
              fill="var(--series-1)"
              fillOpacity={0.35}
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="Interés"
              stackId="cuota"
              stroke="var(--series-2)"
              fill="var(--series-2)"
              fillOpacity={0.35}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      <Card
        title="Saldo pendiente"
        subtitle={mesCruce ? `El principal supera al interés a partir del mes ${mesCruce} (${formatMonths(mesCruce)})` : undefined}
      >
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="mes"
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "var(--border-strong)" }}
              label={{ value: "Mes", position: "insideBottom", offset: -2, fill: "var(--text-muted)", fontSize: 11 }}
            />
            <YAxis
              tickFormatter={tickEur}
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={56}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="Saldo" stroke="var(--series-1)" strokeWidth={2} dot={false} />
            {mesCruce && (
              <ReferenceLine
                x={mesCruce}
                stroke="var(--series-4)"
                strokeDasharray="4 4"
                label={{
                  value: "Cruce principal/interés",
                  position: "insideBottomRight",
                  fill: "var(--series-4)",
                  fontSize: 11,
                }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
