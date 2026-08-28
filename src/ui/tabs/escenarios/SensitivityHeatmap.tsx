import { periodicRate, pmt } from "@/core/finance";
import { Card } from "@/ui/components/Card";
import { formatEUR, formatPct } from "@/ui/format";

// Sequential blue ramp (dataviz skill, references/palette.md — steps 100 & 700).
const RAMP_LIGHT = "#cde2fb";
const RAMP_DARK = "#0d366b";

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function lerpColor(t: number): string {
  const a = hexToRgb(RAMP_LIGHT);
  const b = hexToRgb(RAMP_DARK);
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

const PLAZOS_ANIOS = [15, 20, 25, 30, 35, 40];
const TIPOS_ANUALES = [0.015, 0.025, 0.035, 0.045, 0.055, 0.065];

export function SensitivityHeatmap({ capital }: { capital: number }) {
  const grid = PLAZOS_ANIOS.map((años) =>
    TIPOS_ANUALES.map((tipo) => pmt(periodicRate(tipo, 12), años * 12, capital)),
  );
  const flat = grid.flat();
  const min = Math.min(...flat);
  const max = Math.max(...flat);
  const norm = (v: number) => (max === min ? 0.5 : (v - min) / (max - min));

  return (
    <Card
      title="Sensibilidad: plazo × tipo de interés"
      subtitle={`Cuota mensual resultante para ${formatEUR(capital)} de capital, según combinación de plazo y tipo`}
    >
      <div className="overflow-auto">
        <table className="w-full border-separate text-xs" style={{ borderSpacing: 2 }}>
          <thead>
            <tr>
              <th></th>
              {TIPOS_ANUALES.map((t) => (
                <th key={t} className="px-2 py-1 text-center font-medium" style={{ color: "var(--text-muted)" }}>
                  {formatPct(t, 1)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PLAZOS_ANIOS.map((años, i) => (
              <tr key={años}>
                <td className="pr-2 text-right font-medium" style={{ color: "var(--text-muted)" }}>
                  {años} años
                </td>
                {TIPOS_ANUALES.map((tipo, j) => {
                  const value = grid[i][j];
                  const t = norm(value);
                  return (
                    <td
                      key={tipo}
                      className="tabular-nums rounded px-2 py-2 text-center"
                      style={{ background: lerpColor(t), color: t > 0.55 ? "#ffffff" : "#0b0b0b" }}
                      title={`${años} años · ${formatPct(tipo, 1)} → ${formatEUR(value, 2)}/mes`}
                    >
                      {formatEUR(value, 0)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
        Claro = cuota más baja · oscuro = cuota más alta. Pasa el ratón por una celda para ver el detalle.
      </p>
    </Card>
  );
}
