import { generateSchedule, type TasaConfig } from "@/core/schedule";
import type { HipotecaConfig } from "@/store/types";
import { Card } from "@/ui/components/Card";
import { formatEUR, formatPct } from "@/ui/format";

const EURIBOR_ESCENARIOS = [
  { label: "Euríbor 1%", value: 0.01 },
  { label: "Euríbor 3%", value: 0.03 },
  { label: "Euríbor 5%", value: 0.05 },
];

function tasaPara(tipo: "fijo" | "variable" | "mixto", hipoteca: HipotecaConfig, euribor: number): TasaConfig {
  if (tipo === "fijo") return { tipo: "fijo", tipoAnual: hipoteca.tipoAnualFijoInput };
  if (tipo === "variable") {
    return {
      tipo: "variable",
      diferencial: hipoteca.diferencial,
      euriborActual: euribor,
      frecuenciaRevisionMeses: hipoteca.frecuenciaRevisionMeses,
    };
  }
  return {
    tipo: "mixto",
    aniosFijo: hipoteca.aniosFijo,
    tipoFijoAnual: hipoteca.tipoFijoAnualMixto,
    variable: { diferencial: hipoteca.diferencial, euriborActual: euribor, frecuenciaRevisionMeses: hipoteca.frecuenciaRevisionMeses },
  };
}

const TIPOS: { key: "fijo" | "variable" | "mixto"; label: string }[] = [
  { key: "fijo", label: "Fijo" },
  { key: "variable", label: "Variable" },
  { key: "mixto", label: "Mixto" },
];

export function TasaComparisonTable({
  capital,
  plazoMeses,
  fechaInicio,
  hipoteca,
}: {
  capital: number;
  plazoMeses: number;
  fechaInicio: Date;
  hipoteca: HipotecaConfig;
}) {
  return (
    <Card
      title="Fijo vs. variable vs. mixto bajo estrés de Euríbor"
      subtitle={`Mismo capital (${formatEUR(capital)}) y plazo, distinta modalidad — cuota inicial y coste total en cada escenario`}
    >
      <div className="overflow-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="px-2 py-2 text-left" style={{ color: "var(--text-muted)" }}></th>
              {TIPOS.map((t) => (
                <th key={t.key} className="px-2 py-2 text-left text-sm font-semibold" style={{ color: "var(--text)" }}>
                  {t.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {EURIBOR_ESCENARIOS.map((esc) => (
              <tr key={esc.label} className="border-t" style={{ borderColor: "var(--border)" }}>
                <td className="px-2 py-3 font-medium" style={{ color: "var(--text-secondary)" }}>
                  {esc.label}
                </td>
                {TIPOS.map((t) => {
                  const schedule = generateSchedule({
                    capital,
                    plazoMeses,
                    fechaInicio,
                    tasa: tasaPara(t.key, hipoteca, esc.value),
                  });
                  return (
                    <td key={t.key} className="px-2 py-3">
                      {schedule.ok ? (
                        <>
                          <div className="tabular-nums text-base font-semibold" style={{ color: "var(--text)" }}>
                            {formatEUR(schedule.filas[0].cuota, 2)}
                            <span className="ml-1 text-xs font-normal" style={{ color: "var(--text-muted)" }}>
                              /mes
                            </span>
                          </div>
                          <div className="tabular-nums text-xs" style={{ color: "var(--text-muted)" }}>
                            {formatEUR(schedule.costeTotal)} total · TIN inicial {formatPct(schedule.filas[0].tipoAnualVigente)}
                          </div>
                        </>
                      ) : (
                        <span style={{ color: "var(--critical)" }}>{schedule.error}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
        El fijo no varía con el Euríbor por definición — se repite para comparar en igualdad de condiciones. El
        mixto usa su tramo fijo actual y reacciona al Euríbor solo tras {hipoteca.aniosFijo} años.
      </p>
    </Card>
  );
}
