/**
 * Salamanca capital housing market reference data.
 *
 * Sale prices (€/m²) by barrio: idealista, close of May 2026 (idealista's
 * June close put the city average even higher, at 2,532 €/m²).
 *
 * Rent (€/m²/month) was only reported as a citywide range (9.9–11.1,
 * average ~10.4) — no per-barrio breakdown was published, so every barrio
 * here uses that citywide average as an honest placeholder rather than an
 * invented per-barrio figure. Edit it in the UI once you have a better
 * number for a specific barrio.
 *
 * All of this goes stale — show SALAMANCA_DATA_AS_OF next to it in the UI,
 * and let every value be overridden.
 */

export const SALAMANCA_DATA_AS_OF = "2026-05-31";

export const SALAMANCA_MEDIA_CAPITAL_VENTA_M2 = 2463;
export const SALAMANCA_MEDIA_CAPITAL_ALQUILER_M2 = 10.4;

export interface BarrioSalamanca {
  id: string;
  nombre: string;
  precioVentaM2: number;
  /** No hay dato publicado por barrio; se usa la media de la capital como aproximación editable. */
  precioAlquilerM2Aprox: number;
}

export const SALAMANCA_BARRIOS: BarrioSalamanca[] = [
  { id: "centro", nombre: "Centro", precioVentaM2: 3226, precioAlquilerM2Aprox: SALAMANCA_MEDIA_CAPITAL_ALQUILER_M2 },
  {
    id: "san-bernardo-carmelitas-campus",
    nombre: "San Bernardo – Carmelitas – Campus",
    precioVentaM2: 2971,
    precioAlquilerM2Aprox: SALAMANCA_MEDIA_CAPITAL_ALQUILER_M2,
  },
  {
    id: "prosperidad-delicias",
    nombre: "Prosperidad – Delicias",
    precioVentaM2: 2590,
    precioAlquilerM2Aprox: SALAMANCA_MEDIA_CAPITAL_ALQUILER_M2,
  },
  {
    id: "chinchibarra-capuchinos",
    nombre: "Chinchibarra – Capuchinos",
    precioVentaM2: 2561,
    precioAlquilerM2Aprox: SALAMANCA_MEDIA_CAPITAL_ALQUILER_M2,
  },
  {
    id: "rollo-puente-ladrillo",
    nombre: "Rollo – Puente Ladrillo",
    precioVentaM2: 2416,
    precioAlquilerM2Aprox: SALAMANCA_MEDIA_CAPITAL_ALQUILER_M2,
  },
  { id: "garrido", nombre: "Garrido", precioVentaM2: 2300, precioAlquilerM2Aprox: SALAMANCA_MEDIA_CAPITAL_ALQUILER_M2 },
  {
    id: "vidal-barrio-blanco",
    nombre: "Vidal – Barrio Blanco",
    precioVentaM2: 2117,
    precioAlquilerM2Aprox: SALAMANCA_MEDIA_CAPITAL_ALQUILER_M2,
  },
  {
    id: "pizarrales",
    nombre: "Pizarrales",
    precioVentaM2: 1877,
    precioAlquilerM2Aprox: SALAMANCA_MEDIA_CAPITAL_ALQUILER_M2,
  },
];

export function getBarrioById(id: string): BarrioSalamanca | undefined {
  return SALAMANCA_BARRIOS.find((b) => b.id === id);
}

/** Barrios sorted cheapest to most expensive by sale price — matches how the Viviendas tab lists them. */
export function listarBarriosPorPrecio(): BarrioSalamanca[] {
  return [...SALAMANCA_BARRIOS].sort((a, b) => a.precioVentaM2 - b.precioVentaM2);
}
