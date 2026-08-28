import { useAppStore } from "@/store/useAppStore";
import type { TabId } from "@/store/types";
import { StatTile } from "@/ui/components/StatTile";

const DESTINOS: { id: TabId; label: string; description: string }[] = [
  {
    id: "panel",
    label: "Panel",
    description: "Vista de conjunto: cuota, TAE, coste total, entrada necesaria y veredicto de asequibilidad.",
  },
  {
    id: "viviendas",
    label: "Viviendas",
    description: "El comparador: tabla editable con importación CSV y gráfico de precio frente a m² por barrio.",
  },
  {
    id: "compra",
    label: "Compra",
    description: "El desglose de comprar una vivienda: ITP/IVA+AJD, notaría, registro, gestoría y tasación.",
  },
  {
    id: "hipoteca",
    label: "Hipoteca",
    description: "El simulador: resuelve capital, cuota, plazo o tipo — fija, variable, mixta o amortización anticipada.",
  },
  {
    id: "escenarios",
    label: "Escenarios",
    description: "Fijo vs. variable vs. mixto bajo estrés de Euríbor, alquilar vs. comprar, y mapa de sensibilidad.",
  },
];

export function WelcomeTab() {
  const setActiveTab = useAppStore((s) => s.setActiveTab);

  return (
    <div className="mx-auto flex max-w-4xl flex-col items-center gap-10 py-8 text-center">
      <div className="flex flex-col items-center gap-4">
        <img src="/hiposim-mark.svg" width={96} height={90} alt="HipoSim" style={{ imageRendering: "pixelated" }} />
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text)" }}>
            HipoSim
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            Simulador de hipotecas y de compra de vivienda en Salamanca, Castilla y León
          </p>
        </div>
      </div>

      <div className="grid w-full grid-cols-1 gap-3 text-left sm:grid-cols-2 lg:grid-cols-3">
        {DESTINOS.map((d) => (
          <button
            key={d.id}
            onClick={() => setActiveTab(d.id)}
            className="rounded-lg border px-4 py-3 text-left transition-colors hover:border-[var(--accent)]"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          >
            <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>
              {d.label}
            </div>
            <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
              {d.description}
            </p>
          </button>
        ))}
      </div>

      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile label="Motor de cálculo" value="101 tests" sublabel="verificados contra hoja de referencia" />
        <StatTile label="Normativa" value="Ley 5/2019" sublabel="gastos de hipoteca a cargo del banco" />
        <StatTile label="Euríbor sembrado" value="2,95 %" sublabel="media de agosto de 2026, editable" />
      </div>
    </div>
  );
}
