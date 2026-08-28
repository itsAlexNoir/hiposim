import { describe, expect, it } from "vitest";
import {
  CONDICIONES_COMPRADOR_DEFECTO,
  calcularCostesCompra,
  calcularItp,
  calcularObraNueva,
  calcularOtrosCostes,
} from "./costs";

describe("calcularItp — general scale, verified against plan's stated brackets", () => {
  it("8% flat below the €250,000 threshold", () => {
    const result = calcularItp({ precio: 200_000 }, CONDICIONES_COMPRADOR_DEFECTO);
    expect(result.cuota).toBeCloseTo(16_000, 6);
  });

  it("exactly at the threshold: 8% of 250,000 = 20,000", () => {
    const result = calcularItp({ precio: 250_000 }, CONDICIONES_COMPRADOR_DEFECTO);
    expect(result.cuota).toBeCloseTo(20_000, 6);
  });

  it("above the threshold: 8% of 250k + 10% of the excess = 25,000 for a €300,000 base", () => {
    const result = calcularItp({ precio: 300_000 }, CONDICIONES_COMPRADOR_DEFECTO);
    expect(result.cuota).toBeCloseTo(25_000, 6);
  });
});

describe("calcularItp — reduced rates", () => {
  it("4% for a first home bought by someone under 36", () => {
    const result = calcularItp(
      { precio: 300_000 },
      { ...CONDICIONES_COMPRADOR_DEFECTO, menorDe36: true, primeraViviendaHabitual: true },
    );
    expect(result.tipoAplicado).toBeCloseTo(0.04, 9);
    expect(result.cuota).toBeCloseTo(12_000, 6);
  });

  it("4% for familia numerosa even without the age condition", () => {
    const result = calcularItp(
      { precio: 200_000 },
      { ...CONDICIONES_COMPRADOR_DEFECTO, familiaNumerosa: true, primeraViviendaHabitual: true },
    );
    expect(result.cuota).toBeCloseTo(8_000, 6);
  });

  it("0.01% for an under-36 first home in a rural municipality under €150,000", () => {
    const result = calcularItp(
      { precio: 120_000 },
      {
        ...CONDICIONES_COMPRADOR_DEFECTO,
        menorDe36: true,
        primeraViviendaHabitual: true,
        municipioRural: true,
      },
    );
    expect(result.cuota).toBeCloseTo(12, 6); // 0.01% of 120,000
  });

  it("does NOT apply the rural 0.01% rate once value reaches €150,000 (falls back to 4%)", () => {
    const result = calcularItp(
      { precio: 150_000 },
      {
        ...CONDICIONES_COMPRADOR_DEFECTO,
        menorDe36: true,
        primeraViviendaHabitual: true,
        municipioRural: true,
      },
    );
    expect(result.tipoAplicado).toBeCloseTo(0.04, 9);
  });

  it("Salamanca capital (not rural) does not qualify for the 0.01% rate even under 36 with a cheap flat", () => {
    const result = calcularItp(
      { precio: 100_000 },
      { ...CONDICIONES_COMPRADOR_DEFECTO, menorDe36: true, primeraViviendaHabitual: true, municipioRural: false },
    );
    expect(result.tipoAplicado).toBeCloseTo(0.04, 9);
  });
});

describe("calcularItp — valor de referencia overrides a low escritura price", () => {
  it("taxes on the higher of precio and valorReferencia", () => {
    const result = calcularItp({ precio: 180_000, valorReferencia: 210_000 }, CONDICIONES_COMPRADOR_DEFECTO);
    expect(result.base).toBe(210_000);
    expect(result.cuota).toBeCloseTo(16_800, 6); // 8% of 210,000, not 180,000
  });
});

describe("calcularObraNueva — IVA + AJD", () => {
  it("general case: 10% IVA + 1.5% AJD", () => {
    const result = calcularObraNueva({ precio: 250_000 }, CONDICIONES_COMPRADOR_DEFECTO);
    expect(result.iva.cuota).toBeCloseTo(25_000, 6);
    expect(result.ajd.cuota).toBeCloseTo(3_750, 6);
  });

  it("VPO: 4% IVA instead of 10%", () => {
    const result = calcularObraNueva(
      { precio: 200_000 },
      { ...CONDICIONES_COMPRADOR_DEFECTO, vpo: true },
    );
    expect(result.iva.cuota).toBeCloseTo(8_000, 6);
  });

  it("reduced AJD (0.5%) for a qualifying first-time buyer within income limits", () => {
    const result = calcularObraNueva(
      { precio: 200_000 },
      { ...CONDICIONES_COMPRADOR_DEFECTO, menorDe36: true, primeraViviendaHabitual: true, dentroLimiteRenta: true },
    );
    expect(result.ajd.cuota).toBeCloseTo(1_000, 6); // 0.5%
  });

  it("does not apply the reduced AJD when outside the income limit", () => {
    const result = calcularObraNueva(
      { precio: 200_000 },
      { ...CONDICIONES_COMPRADOR_DEFECTO, menorDe36: true, primeraViviendaHabitual: true, dentroLimiteRenta: false },
    );
    expect(result.ajd.cuota).toBeCloseTo(3_000, 6); // falls back to general 1.5%
  });
});

describe("calcularOtrosCostes — defaults and overrides", () => {
  it("uses sensible midpoint defaults", () => {
    const result = calcularOtrosCostes({ precio: 200_000 });
    expect(result.notaria).toBeCloseTo(700, 6); // 0.35% of 200k
    expect(result.registro).toBeCloseTo(350, 6); // 0.175%
    expect(result.gestoria).toBe(300);
    expect(result.tasacion).toBe(325);
    expect(result.total).toBeCloseTo(1675, 6);
  });

  it("respects overrides", () => {
    const result = calcularOtrosCostes({ precio: 200_000, tasacion: 400, gestoria: 0 });
    expect(result.tasacion).toBe(400);
    expect(result.gestoria).toBe(0);
  });
});

describe("calcularCostesCompra — full waterfall, and the Ley 5/2019 exclusion", () => {
  it("totals reconcile: precio + impuestos + otros costes = total desembolso", () => {
    const result = calcularCostesCompra("segundaMano", { precio: 200_000 });
    expect(result.totalDesembolso).toBeCloseTo(
      result.precio + result.totalImpuestos + result.totalOtrosCostes,
      6,
    );
    const partidaSum = result.partidas.reduce((s, p) => s + p.importe, 0);
    expect(partidaSum).toBeCloseTo(result.totalDesembolso, 6);
  });

  it("never includes any mortgage-deed cost (AJD hipoteca, notaría/registro/gestoría de la hipoteca) — those are bank-paid under Ley 5/2019", () => {
    const result = calcularCostesCompra("segundaMano", { precio: 200_000 });
    const conceptos = result.partidas.map((p) => p.concepto.toLowerCase());
    expect(conceptos.some((c) => c.includes("hipoteca"))).toBe(false);
  });

  it("obra nueva includes both IVA and AJD as separate line items", () => {
    const result = calcularCostesCompra("obraNueva", { precio: 200_000 });
    const conceptos = result.partidas.map((p) => p.concepto);
    expect(conceptos.some((c) => c.startsWith("IVA"))).toBe(true);
    expect(conceptos.some((c) => c.startsWith("AJD"))).toBe(true);
  });
});
