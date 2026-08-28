import { describe, expect, it } from "vitest";
import {
  DEFAULT_COSTES_RECURRENTES,
  calcularCosteTotalPropiedad,
  calcularPrecioM2,
  compararConBarrio,
} from "./property";

describe("calcularPrecioM2", () => {
  it("divides price by area", () => {
    expect(calcularPrecioM2(200_000, 85)).toBeCloseTo(2352.94, 2);
  });

  it("throws for non-positive area", () => {
    expect(() => calcularPrecioM2(200_000, 0)).toThrow();
    expect(() => calcularPrecioM2(200_000, -10)).toThrow();
  });
});

describe("compararConBarrio", () => {
  it("flags a house priced above its barrio benchmark", () => {
    const result = compararConBarrio(2500, 2300); // Garrido benchmark
    expect(result.diferenciaPct).toBeCloseTo((2500 - 2300) / 2300, 6);
    expect(result.diferenciaPct!).toBeGreaterThan(0);
  });

  it("flags a house priced below its barrio benchmark", () => {
    const result = compararConBarrio(2100, 2300);
    expect(result.diferenciaPct!).toBeLessThan(0);
  });

  it("returns null when no barrio benchmark is available", () => {
    const result = compararConBarrio(2500, null);
    expect(result.diferenciaPct).toBeNull();
    expect(result.precioM2Barrio).toBeNull();
  });
});

describe("calcularCosteTotalPropiedad", () => {
  it("totals reconcile: totalDesembolsado - patrimonioNeto = costeRealNeto", () => {
    const result = calcularCosteTotalPropiedad({
      entradaAportada: 40_000,
      costesCompra: 15_000,
      interesesPagados: 30_000,
      costesRecurrentesAnuales: { ...DEFAULT_COSTES_RECURRENTES, ibi: 400, comunidad: 600 },
      anios: 10,
      valorViviendaEstimado: 220_000,
      saldoPendiente: 120_000,
    });
    expect(result.totalDesembolsado).toBeCloseTo(result.patrimonioNeto + result.costeRealNeto, 6);
  });

  it("principal repayment is not counted as a cost — only interest, fees and recurring costs are", () => {
    // Two scenarios with identical interest paid but different remaining
    // balances (i.e. different amounts of principal repaid). Only the
    // resulting patrimonioNeto should differ, not totalDesembolsado.
    const base = {
      entradaAportada: 40_000,
      costesCompra: 15_000,
      interesesPagados: 30_000,
      costesRecurrentesAnuales: DEFAULT_COSTES_RECURRENTES,
      anios: 10,
      valorViviendaEstimado: 220_000,
    };
    const menosAmortizado = calcularCosteTotalPropiedad({ ...base, saldoPendiente: 150_000 });
    const masAmortizado = calcularCosteTotalPropiedad({ ...base, saldoPendiente: 100_000 });

    expect(menosAmortizado.totalDesembolsado).toBeCloseTo(masAmortizado.totalDesembolsado, 6);
    expect(masAmortizado.patrimonioNeto).toBeGreaterThan(menosAmortizado.patrimonioNeto);
    expect(masAmortizado.costeRealNeto).toBeLessThan(menosAmortizado.costeRealNeto);
  });

  it("appreciation can make the real net cost negative", () => {
    const result = calcularCosteTotalPropiedad({
      entradaAportada: 20_000,
      costesCompra: 10_000,
      interesesPagados: 15_000,
      costesRecurrentesAnuales: DEFAULT_COSTES_RECURRENTES,
      anios: 5,
      valorViviendaEstimado: 300_000, // bought at ~200k, appreciated a lot
      saldoPendiente: 150_000,
    });
    expect(result.costeRealNeto).toBeLessThan(0);
  });
});
