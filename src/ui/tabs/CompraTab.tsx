import { RANGOS_OTROS_COSTES } from "@/core/spain/costs";
import { useAppStore } from "@/store/useAppStore";
import { useAsequibilidad, useResumenCompra, useViviendaActiva } from "@/store/selectors";
import { Card } from "@/ui/components/Card";
import { NumberField, PercentField, SelectField, ToggleField } from "@/ui/components/Field";
import { StatTile } from "@/ui/components/StatTile";
import { formatEUR } from "@/ui/format";
import { CostWaterfall } from "./compra/CostWaterfall";

export function CompraTab() {
  const vivienda = useViviendaActiva();
  const updateVivienda = useAppStore((s) => s.updateVivienda);
  const condicionesComprador = useAppStore((s) => s.condicionesComprador);
  const setCondicionesComprador = useAppStore((s) => s.setCondicionesComprador);
  const otrosCostes = useAppStore((s) => s.otrosCostes);
  const setOtrosCostes = useAppStore((s) => s.setOtrosCostes);
  const resumen = useResumenCompra();
  const asequibilidad = useAsequibilidad();

  if (!vivienda || !resumen) {
    return (
      <div style={{ color: "var(--text-muted)" }}>
        Selecciona una vivienda arriba a la derecha para ver su desglose de compra.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Precio vivienda" value={formatEUR(resumen.precio)} />
        <StatTile label="Impuestos" value={formatEUR(resumen.totalImpuestos)} />
        <StatTile label="Otros costes" value={formatEUR(resumen.totalOtrosCostes)} />
        <StatTile label="Total desembolso" value={formatEUR(resumen.totalDesembolso)} status="warning" />
      </div>

      <Card title={vivienda.nombre} subtitle="Tipo de vivienda y elegibilidad para tipos reducidos">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SelectField
            label="Tipo de vivienda"
            value={vivienda.tipoVivienda}
            onChange={(v) => updateVivienda(vivienda.id, { tipoVivienda: v })}
            options={[
              { value: "segundaMano", label: "Segunda mano (ITP)" },
              { value: "obraNueva", label: "Obra nueva (IVA + AJD)" },
            ]}
          />
          <NumberField
            label="Valor de referencia catastral"
            value={vivienda.valorReferencia ?? 0}
            onChange={(v) => updateVivienda(vivienda.id, { valorReferencia: v || undefined })}
            step={1000}
            min={0}
            suffix="€"
          />
          <div className="col-span-2 flex items-end">
            <ToggleField
              label="Municipio rural"
              checked={vivienda.municipioRural}
              onChange={(v) => updateVivienda(vivienda.id, { municipioRural: v })}
              description="<10.000 hab. (o <3.000 a <30km de la capital) — habilita el tipo joven-rural"
            />
          </div>
        </div>
        {vivienda.valorReferencia ? (
          <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
            Base imponible aplicada: {formatEUR(resumen.baseImponible)} (el mayor entre precio y valor de
            referencia)
          </p>
        ) : null}
      </Card>

      <Card
        title="Condiciones del comprador"
        subtitle="Marca las que apliquen — cada una puede reducir el ITP/AJD"
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <ToggleField
            label="Menor de 36 años"
            checked={condicionesComprador.menorDe36}
            onChange={(v) => setCondicionesComprador({ menorDe36: v })}
          />
          <ToggleField
            label="Primera vivienda habitual"
            checked={condicionesComprador.primeraViviendaHabitual}
            onChange={(v) => setCondicionesComprador({ primeraViviendaHabitual: v })}
          />
          <ToggleField
            label="Familia numerosa"
            checked={condicionesComprador.familiaNumerosa}
            onChange={(v) => setCondicionesComprador({ familiaNumerosa: v })}
          />
          <ToggleField
            label="Discapacidad ≥65%"
            checked={condicionesComprador.discapacidad}
            onChange={(v) => setCondicionesComprador({ discapacidad: v })}
          />
          <ToggleField
            label="Vivienda protegida (VPO)"
            checked={condicionesComprador.vpo}
            onChange={(v) => setCondicionesComprador({ vpo: v })}
          />
          <ToggleField
            label="Dentro del límite de renta"
            checked={condicionesComprador.dentroLimiteRenta}
            onChange={(v) => setCondicionesComprador({ dentroLimiteRenta: v })}
            description="Requisito de los tipos AJD reducidos en obra nueva"
          />
        </div>
      </Card>

      <Card title="Desglose de la compra" subtitle="Impuestos según la Junta de Castilla y León · notaría, registro, gestoría y tasación a cargo del comprador">
        <CostWaterfall partidas={resumen.partidas} />
      </Card>

      <Card title="Otros costes" subtitle="Editables — por defecto usan valores intermedios habituales">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <PercentField
            label="Notaría"
            value={otrosCostes.notariaPct ?? 0.0035}
            onChange={(v) => setOtrosCostes({ notariaPct: v })}
            step={0.05}
            min={RANGOS_OTROS_COSTES.notariaPct[0] * 100}
            max={RANGOS_OTROS_COSTES.notariaPct[1] * 100}
          />
          <PercentField
            label="Registro"
            value={otrosCostes.registroPct ?? 0.00175}
            onChange={(v) => setOtrosCostes({ registroPct: v })}
            step={0.05}
            min={RANGOS_OTROS_COSTES.registroPct[0] * 100}
            max={RANGOS_OTROS_COSTES.registroPct[1] * 100}
          />
          <NumberField
            label="Gestoría"
            value={otrosCostes.gestoria ?? 300}
            onChange={(v) => setOtrosCostes({ gestoria: v })}
            step={50}
            min={0}
            suffix="€"
          />
          <NumberField
            label="Tasación"
            value={otrosCostes.tasacion ?? 325}
            onChange={(v) => setOtrosCostes({ tasacion: v })}
            step={25}
            min={RANGOS_OTROS_COSTES.tasacion[0]}
            max={RANGOS_OTROS_COSTES.tasacion[1]}
            suffix="€"
          />
        </div>
        <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
          Desde la Ley 5/2019, el banco paga la notaría, el registro, la gestoría y el AJD de la escritura de
          hipoteca — solo se muestran aquí los costes de la compraventa, que sí corren a tu cargo.
        </p>
      </Card>

      {asequibilidad && (
        <Card title="Financiación necesaria">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatTile label="Préstamo máximo (LTV)" value={formatEUR(asequibilidad.prestamoMaximo)} />
            <StatTile
              label="Entrada + costes necesarios"
              value={formatEUR(asequibilidad.entradaNecesaria)}
              status={asequibilidad.cumpleLtv ? "good" : "critical"}
            />
            <StatTile
              label="Cuota máxima (DTI)"
              value={formatEUR(asequibilidad.cuotaMaximaPorDti, 2)}
              sublabel={`margen: ${formatEUR(asequibilidad.margenCuota, 2)}`}
              status={asequibilidad.cumpleDti ? "good" : "critical"}
            />
          </div>
        </Card>
      )}
    </div>
  );
}
