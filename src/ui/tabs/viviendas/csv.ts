import type { TipoVivienda, ViviendaCandidata } from "@/store/types";

const COLUMNS = ["nombre", "precio", "metrosCuadrados", "barrioId", "tipoVivienda", "municipioRural", "valorReferencia"];

function csvEscape(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export function viviendasToCsv(viviendas: ViviendaCandidata[]): string {
  const rows = viviendas.map((v) =>
    [
      v.nombre,
      String(v.precio),
      String(v.metrosCuadrados),
      v.barrioId ?? "",
      v.tipoVivienda,
      String(v.municipioRural),
      v.valorReferencia !== undefined ? String(v.valorReferencia) : "",
    ]
      .map(csvEscape)
      .join(","),
  );
  return [COLUMNS.join(","), ...rows].join("\n");
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

/** Parses a CSV in the shape viviendasToCsv produces. Skips rows missing a valid precio/metrosCuadrados. */
export function csvToViviendas(text: string): Omit<ViviendaCandidata, "id">[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const header = parseCsvLine(lines[0]).map((h) => h.trim());
  const idx = (name: string) => header.indexOf(name);

  const result: Omit<ViviendaCandidata, "id">[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const precio = Number(cols[idx("precio")]);
    const metrosCuadrados = Number(cols[idx("metrosCuadrados")]);
    if (!Number.isFinite(precio) || precio <= 0 || !Number.isFinite(metrosCuadrados) || metrosCuadrados <= 0) {
      continue;
    }
    const barrioIdRaw = cols[idx("barrioId")];
    const valorReferenciaRaw = idx("valorReferencia") >= 0 ? cols[idx("valorReferencia")] : "";
    const valorReferencia = valorReferenciaRaw ? Number(valorReferenciaRaw) : undefined;

    result.push({
      nombre: cols[idx("nombre")] || "Sin nombre",
      precio,
      metrosCuadrados,
      barrioId: barrioIdRaw || null,
      tipoVivienda: (cols[idx("tipoVivienda")] === "obraNueva" ? "obraNueva" : "segundaMano") as TipoVivienda,
      municipioRural: cols[idx("municipioRural")] === "true",
      valorReferencia: valorReferencia && Number.isFinite(valorReferencia) ? valorReferencia : undefined,
    });
  }
  return result;
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
