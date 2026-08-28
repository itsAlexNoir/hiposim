import { useRef } from "react";
import { SALAMANCA_BARRIOS } from "@/data/salamanca";
import { useAppStore } from "@/store/useAppStore";
import { useViviendasConBenchmark } from "@/store/selectors";
import { Card } from "@/ui/components/Card";
import { formatEurPerM2, formatPct } from "@/ui/format";
import { csvToViviendas, downloadCsv, viviendasToCsv } from "./viviendas/csv";
import { PriceScatter } from "./viviendas/PriceScatter";

const cellInputClass =
  "tabular-nums w-full rounded border-0 bg-transparent px-1 py-1 text-right text-xs outline-none focus:bg-[var(--surface-raised)]";

export function ViviendasTab() {
  const viviendas = useAppStore((s) => s.viviendas);
  const seleccionadaId = useAppStore((s) => s.viviendaSeleccionadaId);
  const selectVivienda = useAppStore((s) => s.selectVivienda);
  const addVivienda = useAppStore((s) => s.addVivienda);
  const updateVivienda = useAppStore((s) => s.updateVivienda);
  const removeVivienda = useAppStore((s) => s.removeVivienda);
  const conBenchmark = useViviendasConBenchmark();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => downloadCsv("viviendas-hiposim.csv", viviendasToCsv(viviendas));

  const handleImportFile = async (file: File) => {
    const text = await file.text();
    for (const v of csvToViviendas(text)) addVivienda(v);
  };

  return (
    <div className="flex flex-col gap-4">
      <Card
        title="Comparador de viviendas"
        subtitle="Precio frente a metros cuadrados, contrastado con el precio de referencia del barrio"
        action={
          <div className="flex gap-2">
            <button
              onClick={() =>
                addVivienda({
                  nombre: "Nueva vivienda",
                  precio: 200_000,
                  metrosCuadrados: 80,
                  barrioId: null,
                  tipoVivienda: "segundaMano",
                  municipioRural: false,
                })
              }
              className="rounded border px-3 py-1.5 text-xs font-medium"
              style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
            >
              + Añadir vivienda
            </button>
            <button
              onClick={handleExport}
              className="rounded border px-3 py-1.5 text-xs font-medium"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            >
              Exportar CSV
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="rounded border px-3 py-1.5 text-xs font-medium"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            >
              Importar CSV
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImportFile(file);
                e.target.value = "";
              }}
            />
          </div>
        }
      >
        <PriceScatter viviendas={viviendas} />
      </Card>

      <Card title="Viviendas candidatas" subtitle={`${viviendas.length} viviendas`}>
        <div className="overflow-auto rounded border" style={{ borderColor: "var(--border)" }}>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: "var(--surface-raised)" }}>
                {["", "Nombre", "Precio", "m²", "€/m²", "Barrio", "Δ barrio", "Tipo", "Rural", ""].map((h, i) => (
                  <th
                    key={i}
                    className="border-b px-2 py-2 text-left text-xs font-medium"
                    style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {conBenchmark.map(({ vivienda: v, benchmark }) => (
                <tr
                  key={v.id}
                  className="border-b last:border-0"
                  style={{ background: v.id === seleccionadaId ? "var(--surface-raised)" : undefined }}
                >
                  <td className="px-2 py-1 text-center">
                    <input
                      type="radio"
                      checked={v.id === seleccionadaId}
                      onChange={() => selectVivienda(v.id)}
                      className="accent-[var(--accent)]"
                      title="Vivienda activa"
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      className="w-40 rounded border-0 bg-transparent px-1 py-1 text-xs outline-none focus:bg-[var(--surface-raised)]"
                      style={{ color: "var(--text)" }}
                      value={v.nombre}
                      onChange={(e) => updateVivienda(v.id, { nombre: e.target.value })}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="number"
                      className={cellInputClass}
                      style={{ color: "var(--text)" }}
                      value={v.precio}
                      step={1000}
                      onChange={(e) => updateVivienda(v.id, { precio: e.target.valueAsNumber || 0 })}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="number"
                      className={cellInputClass}
                      style={{ color: "var(--text)" }}
                      value={v.metrosCuadrados}
                      step={1}
                      onChange={(e) => updateVivienda(v.id, { metrosCuadrados: e.target.valueAsNumber || 0 })}
                    />
                  </td>
                  <td className="px-2 py-1 text-right" style={{ color: "var(--text-secondary)" }}>
                    {formatEurPerM2(benchmark.precioM2)}
                  </td>
                  <td className="px-1 py-1">
                    <select
                      className="rounded border-0 bg-transparent px-1 py-1 text-xs outline-none focus:bg-[var(--surface-raised)]"
                      style={{ color: "var(--text)" }}
                      value={v.barrioId ?? ""}
                      onChange={(e) => updateVivienda(v.id, { barrioId: e.target.value || null })}
                    >
                      <option value="">—</option>
                      {SALAMANCA_BARRIOS.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.nombre}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td
                    className="px-2 py-1 text-right"
                    style={{
                      color:
                        benchmark.diferenciaPct === null
                          ? "var(--text-muted)"
                          : benchmark.diferenciaPct > 0
                            ? "var(--critical)"
                            : "var(--good)",
                    }}
                  >
                    {benchmark.diferenciaPct === null
                      ? "—"
                      : `${benchmark.diferenciaPct > 0 ? "+" : ""}${formatPct(benchmark.diferenciaPct, 1)}`}
                  </td>
                  <td className="px-1 py-1">
                    <select
                      className="rounded border-0 bg-transparent px-1 py-1 text-xs outline-none focus:bg-[var(--surface-raised)]"
                      style={{ color: "var(--text)" }}
                      value={v.tipoVivienda}
                      onChange={(e) => updateVivienda(v.id, { tipoVivienda: e.target.value as typeof v.tipoVivienda })}
                    >
                      <option value="segundaMano">2ª mano</option>
                      <option value="obraNueva">Obra nueva</option>
                    </select>
                  </td>
                  <td className="px-2 py-1 text-center">
                    <input
                      type="checkbox"
                      checked={v.municipioRural}
                      onChange={(e) => updateVivienda(v.id, { municipioRural: e.target.checked })}
                      className="accent-[var(--accent)]"
                    />
                  </td>
                  <td className="px-2 py-1 text-right">
                    <button
                      onClick={() => removeVivienda(v.id)}
                      className="text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
              {viviendas.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-2 py-6 text-center" style={{ color: "var(--text-muted)" }}>
                    No hay viviendas todavía — añade una o importa un CSV.
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
