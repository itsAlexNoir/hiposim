import { describe, expect, it } from "vitest";
import {
  calcularCuotaMaximaPorDti,
  calcularLimiteFinanciacion,
  comisionMaximaAmortizacionAnticipada,
  evaluarAsequibilidad,
} from "./limits";

describe("calcularLimiteFinanciacion — LTV", () => {
  it("caps the loan at 80% of the lower of precio/tasación", () => {
    const result = calcularLimiteFinanciacion(200_000, 200_000, 15_000);
    expect(result.prestamoMaximo).toBeCloseTo(160_000, 6);
    expect(result.entradaMinima).toBeCloseTo(40_000 + 15_000, 6); // 20% down + purchase costs
  });

  it("uses the lower of precio and tasación when they disagree", () => {
    const overvalued = calcularLimiteFinanciacion(220_000, 200_000, 0); // tasación below precio
    expect(overvalued.baseFinanciable).toBe(200_000);
    expect(overvalued.prestamoMaximo).toBeCloseTo(160_000, 6);
  });

  it("defaults tasación to precio when omitted", () => {
    const result = calcularLimiteFinanciacion(200_000, undefined, 0);
    expect(result.baseFinanciable).toBe(200_000);
  });
});

describe("calcularCuotaMaximaPorDti", () => {
  it("caps at 35% of net income by default", () => {
    expect(calcularCuotaMaximaPorDti(2000)).toBeCloseTo(700, 6);
  });

  it("subtracts existing debt service", () => {
    expect(calcularCuotaMaximaPorDti(2000, 200)).toBeCloseTo(500, 6);
  });

  it("never goes negative", () => {
    // 35% of 1000 = 350 cap; debt service of 900 already exceeds it.
    expect(calcularCuotaMaximaPorDti(1000, 900)).toBe(0);
    expect(calcularCuotaMaximaPorDti(1000, 5000)).toBe(0);
    // 35% of 2000 = 700 cap; 200 of existing debt leaves 500 of headroom.
    expect(calcularCuotaMaximaPorDti(2000, 200)).toBe(500);
  });
});

describe("evaluarAsequibilidad — composite LTV + DTI verdict", () => {
  it("passes both checks for a comfortable scenario", () => {
    const result = evaluarAsequibilidad({
      precio: 200_000,
      tasacion: 200_000,
      costesCompra: 15_000,
      capitalPrestamo: 150_000,
      cuotaPropuesta: 600,
      ingresosNetosMensuales: 2500,
    });
    expect(result.cumpleLtv).toBe(true);
    expect(result.cumpleDti).toBe(true);
    expect(result.margenCuota).toBeGreaterThan(0);
  });

  it("flags an over-leveraged loan (fails LTV)", () => {
    const result = evaluarAsequibilidad({
      precio: 200_000,
      costesCompra: 15_000,
      capitalPrestamo: 190_000, // 95% LTV
      cuotaPropuesta: 600,
      ingresosNetosMensuales: 2500,
    });
    expect(result.cumpleLtv).toBe(false);
  });

  it("flags a cuota that exceeds the DTI cap", () => {
    const result = evaluarAsequibilidad({
      precio: 200_000,
      costesCompra: 15_000,
      capitalPrestamo: 150_000,
      cuotaPropuesta: 1200,
      ingresosNetosMensuales: 2000, // 35% cap = 700
    });
    expect(result.cumpleDti).toBe(false);
    expect(result.margenCuota).toBeLessThan(0);
  });
});

describe("comisionMaximaAmortizacionAnticipada — Ley 5/2019 caps", () => {
  it("fixed-rate: 2% within the first 10 years", () => {
    const result = comisionMaximaAmortizacionAnticipada("fijo", 60, 20_000);
    expect(result.porcentaje).toBeCloseTo(0.02, 9);
    expect(result.importeMaximoLegal).toBeCloseTo(400, 6);
  });

  it("fixed-rate: 1.5% after year 10", () => {
    const result = comisionMaximaAmortizacionAnticipada("fijo", 130, 20_000);
    expect(result.porcentaje).toBeCloseTo(0.015, 9);
  });

  it("variable, 0.25%/3yr regime: applies within 3 years, zero after", () => {
    const early = comisionMaximaAmortizacionAnticipada("variable", 20, 20_000, {
      regimenVariable: "0.25-3anos",
    });
    expect(early.porcentaje).toBeCloseTo(0.0025, 9);

    const late = comisionMaximaAmortizacionAnticipada("variable", 40, 20_000, {
      regimenVariable: "0.25-3anos",
    });
    expect(late.porcentaje).toBe(0);
    expect(late.importeMaximoLegal).toBe(0);
  });

  it("variable, 0.15%/5yr regime: applies within 5 years, zero after", () => {
    const early = comisionMaximaAmortizacionAnticipada("variable", 50, 20_000, {
      regimenVariable: "0.15-5anos",
    });
    expect(early.porcentaje).toBeCloseTo(0.0015, 9);

    const late = comisionMaximaAmortizacionAnticipada("variable", 61, 20_000, {
      regimenVariable: "0.15-5anos",
    });
    expect(late.porcentaje).toBe(0);
  });

  it("defaults to the 0.25%/3yr regime when unspecified", () => {
    const result = comisionMaximaAmortizacionAnticipada("variable", 20, 20_000);
    expect(result.porcentaje).toBeCloseTo(0.0025, 9);
  });
});
