import { describe, expect, it } from "vitest";
import { SALAMANCA_AREA_METROPOLITANA, SALAMANCA_BARRIOS, SALAMANCA_ZONAS, getBarrioById, listarBarriosPorPrecio } from "./salamanca";

describe("Salamanca barrio data", () => {
  it("has no duplicate ids", () => {
    const ids = SALAMANCA_BARRIOS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every price is positive", () => {
    for (const b of SALAMANCA_BARRIOS) {
      expect(b.precioVentaM2).toBeGreaterThan(0);
      expect(b.precioAlquilerM2Aprox).toBeGreaterThan(0);
    }
  });

  it("getBarrioById finds Centro and Pizarrales at the extremes", () => {
    const centro = getBarrioById("centro");
    const pizarrales = getBarrioById("pizarrales");
    expect(centro?.precioVentaM2).toBeGreaterThan(pizarrales?.precioVentaM2 ?? 0);
  });

  it("getBarrioById returns undefined for an unknown id", () => {
    expect(getBarrioById("nowhere")).toBeUndefined();
  });

  it("listarBarriosPorPrecio sorts ascending, Pizarrales first, Centro last", () => {
    const sorted = listarBarriosPorPrecio();
    expect(sorted[0].id).toBe("pizarrales");
    expect(sorted.at(-1)!.id).toBe("centro");
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].precioVentaM2).toBeGreaterThanOrEqual(sorted[i - 1].precioVentaM2);
    }
  });
});

describe("Área Metropolitana municipio data", () => {
  it("has no duplicate ids, and none collide with a capital barrio", () => {
    const ids = SALAMANCA_AREA_METROPOLITANA.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    const barrioIds = new Set(SALAMANCA_BARRIOS.map((b) => b.id));
    for (const id of ids) expect(barrioIds.has(id)).toBe(false);
  });

  it("every price is positive", () => {
    for (const m of SALAMANCA_AREA_METROPOLITANA) {
      expect(m.precioVentaM2).toBeGreaterThan(0);
      expect(m.precioAlquilerM2Aprox).toBeGreaterThan(0);
    }
  });

  it("getBarrioById also resolves área metropolitana municipios", () => {
    const santaMarta = getBarrioById("santa-marta-de-tormes");
    expect(santaMarta?.nombre).toBe("Santa Marta de Tormes");
  });

  it("SALAMANCA_ZONAS combines both lists", () => {
    expect(SALAMANCA_ZONAS.length).toBe(SALAMANCA_BARRIOS.length + SALAMANCA_AREA_METROPOLITANA.length);
  });
});
