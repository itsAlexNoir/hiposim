import { periodicRate, pmt } from "@/core/finance";
import { calcularCostesCompra } from "@/core/spain/costs";
import { evaluarAsequibilidad } from "@/core/spain/limits";
import { useAppStore } from "@/store/useAppStore";
import {
  benchmarkVivienda,
  tipoAnualEfectivo,
  useAsequibilidad,
  useCosteTotalPropiedad,
  useResumenCompra,
  useSchedule,
  useSolveResult,
  useTae,
  useViviendaActiva,
} from "@/store/selectors";
import { Card } from "@/ui/components/Card";
import { StatTile } from "@/ui/components/StatTile";
import { formatEUR, formatPct } from "@/ui/format";

export function PanelTab() {
  const vivienda = useViviendaActiva();
  const viviendas = useAppStore((s) => s.viviendas);
  const selectVivienda = useAppStore((s) => s.selectVivienda);
  const hipoteca = useAppStore((s) => s.hipoteca);
  const condicionesComprador = useAppStore((s) => s.condicionesComprador);
  const otrosCostes = useAppStore((s) => s.otrosCostes);
  const perfilFinanciero = useAppStore((s) => s.perfilFinanciero);

  const solveResult = useSolveResult();
  const schedule = useSchedule();
  const tae = useTae();
  const resumenCompra = useResumenCompra();
  const asequibilidad = useAsequibilidad();
  const tco10 = useCosteTotalPropiedad(10);

  return (
    <div className="flex flex-col gap-4">
      {vivienda && solveResult.ok && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile label="Cuota mensual" value={formatEUR(solveResult.cuota, 2)} />
          <StatTile
            label="TAE"
            value={tae?.ok ? formatPct(tae.tae) : "—"}
            sublabel={`vs. ${formatPct(solveResult.tipoAnual)} TIN`}
            title="TAE: coste anual real del préstamo, calculado a partir del TIN más comisión de apertura, tasación y bonificaciones. Siempre es ≥ TIN — es la cifra correcta para comparar ofertas (ver pestaña Hipoteca)."
          />
          <StatTile
            label="Coste total hipoteca"
            value={schedule?.ok ? formatEUR(schedule.costeTotal) : formatEUR(solveResult.costeTotal)}
          />
          <StatTile
            label="Intereses totales"
            value={schedule?.ok ? formatEUR(schedule.interesesTotal) : formatEUR(solveResult.interesesTotal)}
          />
          <StatTile
            label="Entrada + costes"
            value={asequibilidad ? formatEUR(asequibilidad.entradaNecesaria) : "—"}
            status={asequibilidad ? (asequibilidad.cumpleLtv ? "good" : "critical") : "neutral"}
          />
          <StatTile
            label="Coste real a 10 años"
            value={tco10 ? formatEUR(tco10.costeRealNeto) : "—"}
            sublabel="intereses + impuestos + costes − revalorización"
          />
        </div>
      )}

      {vivienda && resumenCompra && asequibilidad && (
        <Card title={vivienda.nombre} subtitle="Resumen de la vivienda activa">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Precio" value={formatEUR(vivienda.precio)} />
            <StatTile label="Total desembolso" value={formatEUR(resumenCompra.totalDesembolso)} />
            <StatTile
              label="¿Cumple LTV?"
              value={asequibilidad.cumpleLtv ? "Sí" : "No"}
              status={asequibilidad.cumpleLtv ? "good" : "critical"}
            />
            <StatTile
              label="¿Cumple DTI?"
              value={asequibilidad.cumpleDti ? "Sí" : "No"}
              status={asequibilidad.cumpleDti ? "good" : "critical"}
              sublabel={`margen: ${formatEUR(asequibilidad.margenCuota, 2)}`}
            />
          </div>
        </Card>
      )}

      <Card
        title="Comparativa de viviendas"
        subtitle={`A ${formatPct(perfilFinanciero.ltvMaximoPct, 0)} de financiación, ${hipoteca.plazoAniosInput} años, ${formatPct(tipoAnualEfectivo(hipoteca))} TIN`}
      >
        <div className="overflow-auto rounded border" style={{ borderColor: "var(--border)" }}>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: "var(--surface-raised)" }}>
                {["", "Vivienda", "Precio", "€/m²", "Δ barrio", "Cuota estimada", "Total desembolso", "Cumple DTI"].map(
                  (h, i) => (
                    <th
                      key={i}
                      className="border-b px-2 py-2 text-left text-xs font-medium"
                      style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {viviendas.map((v) => {
                const benchmark = benchmarkVivienda(v);
                const capitalHipotetico = v.precio * perfilFinanciero.ltvMaximoPct;
                // pmt() throws for plazoAniosInput <= 0 (by design). This runs
                // during render, so guard it — a stale or just-typed invalid
                // value must degrade to "—" (via formatEUR), not crash.
                const cuotaHipotetica =
                  hipoteca.plazoAniosInput > 0
                    ? pmt(periodicRate(tipoAnualEfectivo(hipoteca), 12), hipoteca.plazoAniosInput * 12, capitalHipotetico)
                    : NaN;
                const condiciones = { ...condicionesComprador, municipioRural: v.municipioRural };
                const resumen = calcularCostesCompra(
                  v.tipoVivienda,
                  { precio: v.precio, valorReferencia: v.valorReferencia },
                  condiciones,
                  otrosCostes,
                );
                const verdict = evaluarAsequibilidad({
                  precio: v.precio,
                  costesCompra: resumen.totalImpuestos + resumen.totalOtrosCostes,
                  capitalPrestamo: capitalHipotetico,
                  cuotaPropuesta: cuotaHipotetica,
                  ingresosNetosMensuales: perfilFinanciero.ingresosNetosMensuales,
                  deudaExistenteMensual: perfilFinanciero.deudaExistenteMensual,
                  ltvMaximoPct: perfilFinanciero.ltvMaximoPct,
                  dtiMaximoPct: perfilFinanciero.dtiMaximoPct,
                });

                return (
                  <tr
                    key={v.id}
                    className="cursor-pointer border-b last:border-0"
                    style={{ background: v.id === vivienda?.id ? "var(--surface-raised)" : undefined }}
                    onClick={() => selectVivienda(v.id)}
                  >
                    <td className="px-2 py-1.5 text-center">
                      <input type="radio" readOnly checked={v.id === vivienda?.id} className="accent-[var(--accent)]" />
                    </td>
                    <td className="px-2 py-1.5 font-medium" style={{ color: "var(--text)" }}>
                      {v.nombre}
                    </td>
                    <td className="tabular-nums px-2 py-1.5">{formatEUR(v.precio)}</td>
                    <td className="tabular-nums px-2 py-1.5">{formatEUR(benchmark.precioM2, 0)}</td>
                    <td
                      className="tabular-nums px-2 py-1.5"
                      style={{
                        color:
                          benchmark.diferenciaPct === null
                            ? "var(--text-muted)"
                            : benchmark.diferenciaPct > 0
                              ? "var(--critical)"
                              : "var(--good)",
                      }}
                    >
                      {benchmark.diferenciaPct === null ? "—" : formatPct(benchmark.diferenciaPct, 1)}
                    </td>
                    <td className="tabular-nums px-2 py-1.5">{formatEUR(cuotaHipotetica, 2)}</td>
                    <td className="tabular-nums px-2 py-1.5">{formatEUR(resumen.totalDesembolso)}</td>
                    <td className="px-2 py-1.5" style={{ color: verdict.cumpleDti ? "var(--good)" : "var(--critical)" }}>
                      {verdict.cumpleDti ? "Sí" : "No"}
                    </td>
                  </tr>
                );
              })}
              {viviendas.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-2 py-6 text-center" style={{ color: "var(--text-muted)" }}>
                    Añade viviendas en la pestaña Viviendas para compararlas aquí.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
