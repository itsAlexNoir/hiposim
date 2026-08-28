import { useAppStore } from "@/store/useAppStore";
import { useAsequibilidad } from "@/store/selectors";
import { Card } from "@/ui/components/Card";
import { NumberField, PercentField } from "@/ui/components/Field";
import { StatTile } from "@/ui/components/StatTile";
import { formatEUR, formatMonths } from "@/ui/format";

export function AffordabilityPanel() {
  const perfil = useAppStore((s) => s.perfilFinanciero);
  const setPerfil = useAppStore((s) => s.setPerfilFinanciero);
  const escenarios = useAppStore((s) => s.escenarios);
  const setEscenarios = useAppStore((s) => s.setEscenarios);
  const asequibilidad = useAsequibilidad();

  const mesesParaEntrada =
    asequibilidad && escenarios.ahorroMensualDisponible > 0
      ? asequibilidad.entradaNecesaria / escenarios.ahorroMensualDisponible
      : null;

  return (
    <Card title="Asequibilidad y ahorro" subtitle="¿Cuánto puedes pedir y cuánto tardarías en reunir la entrada?">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <NumberField
          label="Ingresos netos mensuales"
          value={perfil.ingresosNetosMensuales}
          onChange={(v) => setPerfil({ ingresosNetosMensuales: v })}
          step={100}
          min={0}
          suffix="€"
        />
        <NumberField
          label="Deuda existente"
          value={perfil.deudaExistenteMensual}
          onChange={(v) => setPerfil({ deudaExistenteMensual: v })}
          step={50}
          min={0}
          suffix="€/mes"
        />
        <PercentField
          label="LTV máximo"
          value={perfil.ltvMaximoPct}
          onChange={(v) => setPerfil({ ltvMaximoPct: v })}
          step={1}
          min={0}
          max={100}
        />
        <PercentField
          label="DTI máximo"
          value={perfil.dtiMaximoPct}
          onChange={(v) => setPerfil({ dtiMaximoPct: v })}
          step={1}
          min={0}
          max={100}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <NumberField
          label="Ahorro mensual disponible"
          value={escenarios.ahorroMensualDisponible}
          onChange={(v) => setEscenarios({ ahorroMensualDisponible: v })}
          step={50}
          min={0}
          suffix="€"
        />
        {asequibilidad && (
          <>
            <StatTile
              label="Cuota máxima (DTI)"
              value={formatEUR(asequibilidad.cuotaMaximaPorDti, 2)}
              status={asequibilidad.cumpleDti ? "good" : "critical"}
            />
            <StatTile label="Entrada + costes necesarios" value={formatEUR(asequibilidad.entradaNecesaria)} />
            <StatTile
              label="Tiempo para reunirla"
              value={mesesParaEntrada !== null ? formatMonths(mesesParaEntrada) : "—"}
              sublabel={`ahorrando ${formatEUR(escenarios.ahorroMensualDisponible)}/mes`}
            />
          </>
        )}
      </div>
    </Card>
  );
}
