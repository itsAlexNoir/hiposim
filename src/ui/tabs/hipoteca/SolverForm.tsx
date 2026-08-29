import { useAppStore } from "@/store/useAppStore";
import { tipoAnualEfectivo, useSolveResult } from "@/store/selectors";
import type { SolveFor } from "@/core/solve";
import { NumberField, PercentField, SelectField, TextField, ToggleField } from "@/ui/components/Field";
import { Card } from "@/ui/components/Card";
import { formatEUR, formatMonths, formatPct } from "@/ui/format";

const SOLVE_FOR_OPTIONS: { value: SolveFor; label: string }[] = [
  { value: "capital", label: "Importe a pedir" },
  { value: "cuota", label: "Cuota mensual" },
  { value: "plazo", label: "Plazo" },
  { value: "tipo", label: "Tipo de interés" },
];

function ResultTile({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded border px-3 py-2"
      style={{ background: "var(--surface-raised)", borderColor: "var(--accent)" }}
    >
      <div className="text-xs" style={{ color: "var(--text-muted)" }}>
        {label} <span style={{ color: "var(--accent)" }}>· resultado</span>
      </div>
      <div className="tabular-nums text-lg font-semibold" style={{ color: "var(--text)" }}>
        {value}
      </div>
    </div>
  );
}

export function SolverForm() {
  const hipoteca = useAppStore((s) => s.hipoteca);
  const setHipoteca = useAppStore((s) => s.setHipoteca);
  const solveResult = useSolveResult();

  const solvedCapital = solveResult.ok && hipoteca.solveFor === "capital" ? solveResult.capital : null;
  const solvedCuota = solveResult.ok && hipoteca.solveFor === "cuota" ? solveResult.cuota : null;
  const solvedPlazo = solveResult.ok && hipoteca.solveFor === "plazo" ? solveResult.plazoMesesExacto : null;
  const solvedTipo = solveResult.ok && hipoteca.solveFor === "tipo" ? solveResult.tipoAnual : null;

  return (
    <div className="flex flex-col gap-4">
      <Card title="¿Qué quieres calcular?" subtitle="Elige la incógnita; los otros tres datos son las entradas">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SOLVE_FOR_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setHipoteca({ solveFor: opt.value })}
              className="rounded border px-3 py-2 text-sm font-medium"
              style={{
                borderColor: hipoteca.solveFor === opt.value ? "var(--accent)" : "var(--border)",
                background: hipoteca.solveFor === opt.value ? "var(--surface-raised)" : "transparent",
                color: hipoteca.solveFor === opt.value ? "var(--text)" : "var(--text-secondary)",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {!solveResult.ok && (
          <div
            className="mt-3 rounded border px-3 py-2 text-sm"
            style={{ borderColor: "var(--critical)", color: "var(--critical)", background: "var(--surface-raised)" }}
          >
            {solveResult.error}
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {hipoteca.solveFor === "capital" ? (
            <ResultTile label="Importe a pedir" value={solvedCapital !== null ? formatEUR(solvedCapital) : "—"} />
          ) : (
            <NumberField
              label="Importe a pedir"
              value={hipoteca.capitalInput}
              onChange={(v) => setHipoteca({ capitalInput: v })}
              step={1000}
              min={0}
              suffix="€"
            />
          )}

          {hipoteca.solveFor === "cuota" ? (
            <ResultTile label="Cuota mensual" value={solvedCuota !== null ? formatEUR(solvedCuota, 2) : "—"} />
          ) : (
            <NumberField
              label="Cuota mensual"
              value={hipoteca.cuotaInput}
              onChange={(v) => setHipoteca({ cuotaInput: v })}
              step={10}
              min={0}
              suffix="€"
            />
          )}

          {hipoteca.solveFor === "plazo" ? (
            <ResultTile label="Plazo" value={solvedPlazo !== null ? formatMonths(solvedPlazo) : "—"} />
          ) : (
            <NumberField
              label="Plazo (años)"
              value={hipoteca.plazoAniosInput}
              onChange={(v) => setHipoteca({ plazoAniosInput: v })}
              step={1}
              min={1}
              max={40}
            />
          )}

          {hipoteca.solveFor === "tipo" ? (
            <ResultTile label="Tipo de interés (TIN)" value={solvedTipo !== null ? formatPct(solvedTipo) : "—"} />
          ) : hipoteca.tipoHipoteca === "fijo" ? (
            <PercentField
              label="Tipo de interés (TIN)"
              value={hipoteca.tipoAnualFijoInput}
              onChange={(v) => setHipoteca({ tipoAnualFijoInput: v })}
              step={0.05}
              min={0}
            />
          ) : (
            <ResultTile
              label="Tipo de interés inicial (TIN)"
              value={formatPct(tipoAnualEfectivo(hipoteca))}
            />
          )}
        </div>
      </Card>

      <Card title="Tipo de hipoteca">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SelectField
            label="Modalidad"
            value={hipoteca.tipoHipoteca}
            onChange={(v) => setHipoteca({ tipoHipoteca: v })}
            options={[
              { value: "fijo", label: "Fijo" },
              { value: "variable", label: "Variable" },
              { value: "mixto", label: "Mixto" },
            ]}
          />

          {hipoteca.tipoHipoteca !== "fijo" && (
            <>
              <PercentField
                label="Diferencial sobre Euríbor"
                value={hipoteca.diferencial}
                onChange={(v) => setHipoteca({ diferencial: v })}
                step={0.05}
                min={0}
              />
              <PercentField
                label="Euríbor actual"
                value={hipoteca.euriborActual}
                onChange={(v) => setHipoteca({ euriborActual: v })}
                step={0.05}
              />
              <SelectField
                label="Revisión"
                value={String(hipoteca.frecuenciaRevisionMeses) as "6" | "12"}
                onChange={(v) => setHipoteca({ frecuenciaRevisionMeses: Number(v) as 6 | 12 })}
                options={[
                  { value: "6", label: "Cada 6 meses" },
                  { value: "12", label: "Cada 12 meses" },
                ]}
              />
            </>
          )}

          {hipoteca.tipoHipoteca === "mixto" && (
            <>
              <NumberField
                label="Años a tipo fijo"
                value={hipoteca.aniosFijo}
                onChange={(v) => setHipoteca({ aniosFijo: v })}
                step={1}
                min={1}
                max={hipoteca.plazoAniosInput - 1}
              />
              <PercentField
                label="Tipo fijo inicial"
                value={hipoteca.tipoFijoAnualMixto}
                onChange={(v) => setHipoteca({ tipoFijoAnualMixto: v })}
                step={0.05}
                min={0}
              />
            </>
          )}
        </div>
      </Card>

      <Card title="Carencia y comisión de apertura">
        <div className="flex flex-col gap-3">
          <ToggleField
            label="Periodo de carencia"
            checked={hipoteca.carenciaMeses > 0}
            onChange={(v) => setHipoteca({ carenciaMeses: v ? 12 : 0 })}
            description="Meses iniciales sin amortizar principal"
          />
          {hipoteca.carenciaMeses > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <NumberField
                label="Meses de carencia"
                value={hipoteca.carenciaMeses}
                onChange={(v) => setHipoteca({ carenciaMeses: v })}
                step={1}
                min={1}
                max={hipoteca.plazoAniosInput * 12 - 1}
              />
              <SelectField
                label="Tipo de carencia"
                value={hipoteca.carenciaTipo}
                onChange={(v) => setHipoteca({ carenciaTipo: v })}
                options={[
                  { value: "parcial", label: "Parcial (solo intereses)" },
                  { value: "total", label: "Total (nada, capitaliza)" },
                ]}
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <PercentField
              label="Comisión de apertura"
              value={hipoteca.comisionAperturaPct}
              onChange={(v) => setHipoteca({ comisionAperturaPct: v })}
              step={0.05}
              min={0}
            />
          </div>
        </div>
      </Card>

      <BonificacionesEditor />
    </div>
  );
}

function BonificacionesEditor() {
  const hipoteca = useAppStore((s) => s.hipoteca);
  const setHipoteca = useAppStore((s) => s.setHipoteca);

  const update = (i: number, patch: Partial<{ nombre: string; costeAnual: number }>) => {
    const next = hipoteca.bonificaciones.map((b, idx) => (idx === i ? { ...b, ...patch } : b));
    setHipoteca({ bonificaciones: next });
  };
  const remove = (i: number) => {
    setHipoteca({ bonificaciones: hipoteca.bonificaciones.filter((_, idx) => idx !== i) });
  };
  const add = () => {
    setHipoteca({ bonificaciones: [...hipoteca.bonificaciones, { nombre: "Seguro de hogar", costeAnual: 250 }] });
  };

  return (
    <Card
      title="Bonificaciones"
      subtitle="Productos que exige el banco a cambio del tipo pactado — su coste real entra en la TAE"
    >
      <div className="flex flex-col gap-2">
        {hipoteca.bonificaciones.map((b, i) => (
          <div key={i} className="flex items-end gap-2">
            <div className="flex-1">
              <TextField label="Producto" value={b.nombre} onChange={(v) => update(i, { nombre: v })} />
            </div>
            <div className="w-32">
              <NumberField
                label="Coste anual"
                value={b.costeAnual}
                onChange={(v) => update(i, { costeAnual: v })}
                step={10}
                min={0}
                suffix="€/año"
              />
            </div>
            <button
              onClick={() => remove(i)}
              className="mb-0.5 rounded border px-2 py-1.5 text-xs"
              style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
            >
              Quitar
            </button>
          </div>
        ))}
        <button
          onClick={add}
          className="self-start rounded border px-3 py-1.5 text-xs font-medium"
          style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
        >
          + Añadir bonificación
        </button>
      </div>
    </Card>
  );
}
