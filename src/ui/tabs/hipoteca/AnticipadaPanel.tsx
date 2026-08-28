import { comisionMaximaAmortizacionAnticipada } from "@/core/spain/limits";
import { useAppStore } from "@/store/useAppStore";
import { tipoParaPenalizacion, useSchedule, useScheduleSinAnticipada } from "@/store/selectors";
import { Card } from "@/ui/components/Card";
import { NumberField, SelectField } from "@/ui/components/Field";
import { StatTile } from "@/ui/components/StatTile";
import { formatEUR, formatMonths, formatPct } from "@/ui/format";

export function AnticipadaPanel() {
  const hipoteca = useAppStore((s) => s.hipoteca);
  const setHipoteca = useAppStore((s) => s.setHipoteca);
  const conAnticipada = useSchedule();
  const sinAnticipada = useScheduleSinAnticipada();

  const update = (i: number, patch: Partial<(typeof hipoteca.amortizacionesAnticipadas)[number]>) => {
    const next = hipoteca.amortizacionesAnticipadas.map((a, idx) =>
      idx === i ? ({ ...a, ...patch } as (typeof hipoteca.amortizacionesAnticipadas)[number]) : a,
    );
    setHipoteca({ amortizacionesAnticipadas: next });
  };
  const remove = (i: number) => {
    setHipoteca({ amortizacionesAnticipadas: hipoteca.amortizacionesAnticipadas.filter((_, idx) => idx !== i) });
  };
  const add = () => {
    setHipoteca({
      amortizacionesAnticipadas: [
        ...hipoteca.amortizacionesAnticipadas,
        { tipo: "unica", mes: 12, importe: 5000, modo: "reducirPlazo" },
      ],
    });
  };

  const ahorro =
    conAnticipada?.ok && sinAnticipada?.ok ? sinAnticipada.interesesTotal - conAnticipada.interesesTotal : null;
  const mesesAhorrados = conAnticipada?.ok && sinAnticipada?.ok ? sinAnticipada.mesesReales - conAnticipada.mesesReales : null;

  return (
    <Card
      title="Amortización anticipada"
      subtitle="Pagos extra, únicos o recurrentes — reduce cuota o reduce plazo"
    >
      <div className="flex flex-col gap-3">
        {hipoteca.amortizacionesAnticipadas.map((a, i) => (
          <div key={i} className="grid grid-cols-2 gap-2 rounded border p-2 sm:grid-cols-5" style={{ borderColor: "var(--border)" }}>
            <SelectField
              label="Frecuencia"
              value={a.tipo}
              onChange={(v) => update(i, { tipo: v as "unica" | "recurrente" })}
              options={[
                { value: "unica", label: "Pago único" },
                { value: "recurrente", label: "Recurrente" },
              ]}
            />
            <NumberField label="Mes" value={a.mes} onChange={(v) => update(i, { mes: v })} step={1} min={1} />
            {a.tipo === "recurrente" && (
              <NumberField
                label="Cada (meses)"
                value={a.frecuenciaMeses}
                onChange={(v) => update(i, { frecuenciaMeses: v })}
                step={1}
                min={1}
              />
            )}
            <NumberField label="Importe" value={a.importe} onChange={(v) => update(i, { importe: v })} step={500} min={0} suffix="€" />
            <SelectField
              label="Modo"
              value={a.modo}
              onChange={(v) => update(i, { modo: v as "reducirCuota" | "reducirPlazo" })}
              options={[
                { value: "reducirPlazo", label: "Reducir plazo" },
                { value: "reducirCuota", label: "Reducir cuota" },
              ]}
            />
            <div className="flex items-end gap-2">
              <PenalizacionBadge mes={a.mes} importe={a.importe} />
              <button
                onClick={() => remove(i)}
                className="mb-0.5 rounded border px-2 py-1.5 text-xs"
                style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
              >
                Quitar
              </button>
            </div>
          </div>
        ))}
        <button
          onClick={add}
          className="self-start rounded border px-3 py-1.5 text-xs font-medium"
          style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
        >
          + Añadir amortización
        </button>

        {hipoteca.amortizacionesAnticipadas.length > 0 && ahorro !== null && (
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatTile label="Intereses ahorrados" value={formatEUR(ahorro, 0)} status="good" />
            <StatTile
              label="Plazo reducido en"
              value={mesesAhorrados ? formatMonths(mesesAhorrados) : "0 meses"}
            />
            <StatTile
              label="Nueva duración"
              value={conAnticipada?.ok ? formatMonths(conAnticipada.mesesReales) : "—"}
            />
          </div>
        )}
      </div>
    </Card>
  );
}

function PenalizacionBadge({ mes, importe }: { mes: number; importe: number }) {
  const hipoteca = useAppStore((s) => s.hipoteca);
  const tipo = tipoParaPenalizacion(hipoteca, mes);
  const comision = comisionMaximaAmortizacionAnticipada(tipo, mes, importe);

  return (
    <div className="text-[11px]" style={{ color: "var(--text-muted)" }} title={comision.motivo}>
      Máx. legal: {comision.porcentaje > 0 ? `${formatPct(comision.porcentaje)} (${formatEUR(comision.importeMaximoLegal)})` : "sin coste"}
    </div>
  );
}
