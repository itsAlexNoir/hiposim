import type { ScheduleRow } from "@/core/schedule";
import { Card } from "@/ui/components/Card";
import { formatDate, formatEUR } from "@/ui/format";

const thClass = "sticky top-0 border-b px-3 py-2 text-right text-xs font-medium first:text-left";
const tdClass = "tabular-nums whitespace-nowrap px-3 py-1.5 text-right first:text-left";

export function AmortizacionTable({ filas }: { filas: ScheduleRow[] }) {
  return (
    <Card title="Cuadro de amortización" subtitle={`${filas.length} pagos`}>
      <div className="max-h-[480px] overflow-auto rounded border" style={{ borderColor: "var(--border)" }}>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ background: "var(--surface-raised)" }}>
              {["N.º", "Fecha", "Saldo inicial", "Cuota", "Principal", "Interés", "Extra", "Saldo final"].map((h) => (
                <th key={h} className={thClass} style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr
                key={f.n}
                style={{
                  color: "var(--text-secondary)",
                  background: f.esCarencia ? "var(--surface-raised)" : undefined,
                }}
                className="border-b last:border-0"
              >
                <td className={tdClass} style={{ borderColor: "var(--border)", color: "var(--text)" }}>
                  {f.n}
                  {f.esRevision && (
                    <span className="ml-1 text-[10px]" style={{ color: "var(--accent)" }} title="Revisión de tipo">
                      ↻
                    </span>
                  )}
                </td>
                <td className={tdClass} style={{ borderColor: "var(--border)" }}>
                  {formatDate(f.fecha)}
                </td>
                <td className={tdClass} style={{ borderColor: "var(--border)" }}>
                  {formatEUR(f.saldoInicial, 2)}
                </td>
                <td className={tdClass} style={{ borderColor: "var(--border)" }}>
                  {formatEUR(f.cuota, 2)}
                </td>
                <td className={tdClass} style={{ borderColor: "var(--border)", color: "var(--series-1)" }}>
                  {formatEUR(f.principal, 2)}
                </td>
                <td className={tdClass} style={{ borderColor: "var(--border)", color: "var(--series-2)" }}>
                  {formatEUR(f.interes, 2)}
                </td>
                <td className={tdClass} style={{ borderColor: "var(--border)", color: f.extra > 0 ? "var(--good)" : "var(--text-muted)" }}>
                  {f.extra > 0 ? formatEUR(f.extra, 2) : "—"}
                </td>
                <td className={tdClass} style={{ borderColor: "var(--border)", color: "var(--text)" }}>
                  {formatEUR(f.saldoFinal, 2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
