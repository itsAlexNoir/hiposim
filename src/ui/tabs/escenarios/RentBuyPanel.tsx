import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { useAppStore } from "@/store/useAppStore";
import { useRentBuy } from "@/store/selectors";
import { Card } from "@/ui/components/Card";
import { NumberField, PercentField } from "@/ui/components/Field";
import { StatTile } from "@/ui/components/StatTile";
import { formatEUR } from "@/ui/format";

function tickEur(v: number): string {
  if (Math.abs(v) >= 1000) return `${Math.round(v / 1000)}k €`;
  return `${Math.round(v)} €`;
}

export function RentBuyPanel() {
  const escenarios = useAppStore((s) => s.escenarios);
  const setEscenarios = useAppStore((s) => s.setEscenarios);
  const resultado = useRentBuy();

  const data = resultado
    ? [
        { nombre: "Comprando", valor: resultado.patrimonioNetoComprando },
        { nombre: "Alquilando e invirtiendo", valor: resultado.patrimonioNetoAlquilando },
      ]
    : [];

  return (
    <Card
      title="Alquilar vs. comprar"
      subtitle="Patrimonio neto tras el horizonte elegido — comprando (vivienda − hipoteca) frente a alquilar e invertir la diferencia"
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <NumberField
          label="Horizonte"
          value={escenarios.aniosRentBuy}
          onChange={(v) => setEscenarios({ aniosRentBuy: v })}
          step={1}
          min={1}
          max={40}
          suffix="años"
        />
        <NumberField
          label="Alquiler mensual inicial"
          value={escenarios.alquilerMensualInicial}
          onChange={(v) => setEscenarios({ alquilerMensualInicial: v })}
          step={25}
          min={0}
          suffix="€"
        />
        <PercentField
          label="Crecimiento alquiler"
          value={escenarios.crecimientoAlquilerAnual}
          onChange={(v) => setEscenarios({ crecimientoAlquilerAnual: v })}
          step={0.1}
        />
        <PercentField
          label="Rentabilidad alternativa"
          value={escenarios.rentabilidadInversionAnual}
          onChange={(v) => setEscenarios({ rentabilidadInversionAnual: v })}
          step={0.1}
        />
        <PercentField
          label="Revalorización vivienda"
          value={escenarios.crecimientoValorViviendaAnual}
          onChange={(v) => setEscenarios({ crecimientoValorViviendaAnual: v })}
          step={0.1}
        />
      </div>

      {resultado ? (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data} margin={{ top: 20, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="nombre" tick={{ fill: "var(--text-muted)", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "var(--border-strong)" }} />
              <YAxis tickFormatter={tickEur} tick={{ fill: "var(--text-muted)", fontSize: 11 }} tickLine={false} axisLine={false} width={56} />
              <Bar dataKey="valor" fill="var(--series-1)" radius={[2, 2, 0, 0]}>
                <Cell fill="var(--series-1)" />
                <Cell fill="var(--series-3)" />
                <LabelList dataKey="valor" position="top" formatter={(v: unknown) => formatEUR(Number(v))} style={{ fill: "var(--text-secondary)", fontSize: 11 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          <div className="flex flex-col justify-center gap-3">
            <StatTile
              label={resultado.diferencia >= 0 ? "Comprar sale mejor por" : "Alquilar sale mejor por"}
              value={formatEUR(Math.abs(resultado.diferencia))}
              status={resultado.diferencia >= 0 ? "good" : "warning"}
            />
            <StatTile label="Alquiler total pagado" value={formatEUR(resultado.costeTotalAlquilerAcumulado)} />
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm" style={{ color: "var(--text-muted)" }}>
          Selecciona una vivienda y revisa los datos de la hipoteca para ver esta comparación.
        </p>
      )}
    </Card>
  );
}
