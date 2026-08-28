import { useAppStore } from "@/store/useAppStore";
import { formatEUR } from "@/ui/format";

export function ViviendaSwitcher() {
  const viviendas = useAppStore((s) => s.viviendas);
  const selectedId = useAppStore((s) => s.viviendaSeleccionadaId);
  const selectVivienda = useAppStore((s) => s.selectVivienda);

  if (viviendas.length === 0) return null;

  return (
    <label className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
      <span>Vivienda activa</span>
      <select
        className="tabular-nums rounded border px-2 py-1.5 text-sm"
        style={{ background: "var(--surface-raised)", borderColor: "var(--border)", color: "var(--text)" }}
        value={selectedId ?? ""}
        onChange={(e) => selectVivienda(e.target.value || null)}
      >
        {viviendas.map((v) => (
          <option key={v.id} value={v.id}>
            {v.nombre} — {formatEUR(v.precio)}
          </option>
        ))}
      </select>
    </label>
  );
}
