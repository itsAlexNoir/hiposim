import { useAppStore } from "@/store/useAppStore";
import { useSolveResult } from "@/store/selectors";
import { AffordabilityPanel } from "./escenarios/AffordabilityPanel";
import { RentBuyPanel } from "./escenarios/RentBuyPanel";
import { SensitivityHeatmap } from "./escenarios/SensitivityHeatmap";
import { TasaComparisonTable } from "./escenarios/TasaComparisonTable";

const FECHA_INICIO = new Date();

export function EscenariosTab() {
  const hipoteca = useAppStore((s) => s.hipoteca);
  const solveResult = useSolveResult();

  if (!solveResult.ok) {
    return (
      <div style={{ color: "var(--text-muted)" }}>
        Corrige los datos en la pestaña Hipoteca para ver los escenarios.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <TasaComparisonTable
        capital={solveResult.capital}
        plazoMeses={solveResult.plazoMeses}
        fechaInicio={FECHA_INICIO}
        hipoteca={hipoteca}
      />
      <RentBuyPanel />
      <AffordabilityPanel />
      <SensitivityHeatmap capital={solveResult.capital} />
    </div>
  );
}
