import { useSchedule, useSolveResult, useTae } from "@/store/selectors";
import { StatTile } from "@/ui/components/StatTile";
import { formatEUR, formatMonths, formatPct } from "@/ui/format";
import { SolverForm } from "./hipoteca/SolverForm";
import { AmortizacionCharts } from "./hipoteca/AmortizacionCharts";
import { AmortizacionTable } from "./hipoteca/AmortizacionTable";
import { AnticipadaPanel } from "./hipoteca/AnticipadaPanel";

export function HipotecaTab() {
  const solveResult = useSolveResult();
  const schedule = useSchedule();
  const tae = useTae();

  return (
    <div className="flex flex-col gap-4">
      {solveResult.ok && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile label="Cuota mensual" value={formatEUR(solveResult.cuota, 2)} />
          <StatTile label="Importe prestado" value={formatEUR(solveResult.capital)} />
          <StatTile label="Plazo" value={formatMonths(solveResult.plazoMesesExacto)} />
          <StatTile
            label="TIN"
            value={formatPct(solveResult.tipoAnual)}
            sublabel="tipo nominal pactado"
            title="TIN: el porcentaje que el banco añade al capital prestado. Es el tipo pactado en el contrato, pero no incluye comisiones ni el coste de las bonificaciones."
          />
          <StatTile
            label="TAE"
            value={tae?.ok ? formatPct(tae.tae) : "—"}
            sublabel="incluye comisiones y bonificaciones"
            title="TAE: coste anual real del préstamo. Parte del TIN y le suma la comisión de apertura, la tasación y el coste de mantener las bonificaciones — por eso la TAE es siempre ≥ TIN, y es la cifra correcta para comparar ofertas."
          />
          <StatTile
            label="Coste total"
            value={schedule?.ok ? formatEUR(schedule.costeTotal) : formatEUR(solveResult.costeTotal)}
            sublabel={
              schedule?.ok
                ? `${formatEUR(schedule.interesesTotal)} en intereses`
                : `${formatEUR(solveResult.interesesTotal)} en intereses`
            }
          />
        </div>
      )}

      {solveResult.ok && tae?.ok && (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          El <strong>TIN</strong> ({formatPct(solveResult.tipoAnual)}) es solo el tipo de interés que el banco aplica al
          capital; la <strong>TAE</strong> ({formatPct(tae.tae)}) traduce ese TIN al coste real anual, sumando comisión
          de apertura, tasación y el coste de las bonificaciones exigidas. Por eso la TAE es la cifra que hay que
          comparar entre bancos, nunca el TIN por sí solo (
          <a
            href="https://www.bancosantander.es/glosario/tin/"
            target="_blank"
            rel="noreferrer"
            style={{ color: "var(--accent)" }}
          >
            definición de TIN — Banco Santander
          </a>
          ).
        </p>
      )}

      <SolverForm />

      {schedule?.ok && (
        <>
          <AmortizacionCharts filas={schedule.filas} mesCruce={schedule.mesCruce} />
          <AnticipadaPanel />
          <AmortizacionTable filas={schedule.filas} />
        </>
      )}

      {schedule && !schedule.ok && (
        <div
          className="rounded border px-3 py-2 text-sm"
          style={{ borderColor: "var(--critical)", color: "var(--critical)", background: "var(--surface)" }}
        >
          {schedule.error}
        </div>
      )}
    </div>
  );
}
