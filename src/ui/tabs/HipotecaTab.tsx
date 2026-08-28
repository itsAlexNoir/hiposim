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
          <StatTile label="TIN" value={formatPct(solveResult.tipoAnual)} />
          <StatTile label="TAE" value={tae?.ok ? formatPct(tae.tae) : "—"} sublabel="incluye comisiones y bonificaciones" />
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
