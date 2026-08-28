import { describe, expect, it } from "vitest";
import { solveLoan, type SolveSuccess } from "./solve";

function expectOk(result: ReturnType<typeof solveLoan>): asserts result is SolveSuccess {
  if (!result.ok) throw new Error(`Expected ok, got error: ${result.error}`);
}

describe("solveLoan — matches the seed spreadsheet when solving for cuota", () => {
  it("reproduces the golden scenario", () => {
    const result = solveLoan({ solveFor: "cuota", capital: 5000, tipoAnual: 0.055, plazoAnios: 5 });
    expectOk(result);
    expect(result.cuota).toBeCloseTo(95.5058108589112, 6);
    expect(result.costeTotal).toBeCloseTo(5730.348651534672, 4);
    expect(result.interesesTotal).toBeCloseTo(730.3486515346722, 4);
    expect(result.primerPago.interes).toBeCloseTo(22.916666666666668, 6);
    expect(result.primerPago.principal).toBeCloseTo(72.58914419224453, 4);
  });
});

describe("solveLoan — solving for capital (the headline feature)", () => {
  it("'I can pay €X/month, what can I borrow?' round-trips against solving for cuota", () => {
    const forward = solveLoan({ solveFor: "cuota", capital: 200_000, tipoAnual: 0.032, plazoAnios: 25 });
    expectOk(forward);

    const inverse = solveLoan({
      solveFor: "capital",
      cuota: forward.cuota,
      tipoAnual: 0.032,
      plazoAnios: 25,
    });
    expectOk(inverse);
    expect(inverse.capital).toBeCloseTo(200_000, 3);
  });

  it("returns a sensible first-payment split for a realistic mortgage", () => {
    const result = solveLoan({ solveFor: "capital", cuota: 800, tipoAnual: 0.03, plazoAnios: 30 });
    expectOk(result);
    expect(result.capital).toBeGreaterThan(0);
    expect(result.primerPago.interes + result.primerPago.principal).toBeCloseTo(result.cuota, 6);
    // Early in a 30yr loan most of the payment is interest.
    expect(result.primerPago.interes).toBeGreaterThan(result.primerPago.principal);
  });
});

describe("solveLoan — solving for plazo and tipo round-trip the other modes", () => {
  it("plazo round-trips cuota", () => {
    const forward = solveLoan({ solveFor: "cuota", capital: 150_000, tipoAnual: 0.04, plazoAnios: 20 });
    expectOk(forward);

    const inverse = solveLoan({
      solveFor: "plazo",
      capital: 150_000,
      cuota: forward.cuota,
      tipoAnual: 0.04,
    });
    expectOk(inverse);
    expect(inverse.plazoMesesExacto).toBeCloseTo(240, 1);
  });

  it("tipo round-trips cuota", () => {
    const forward = solveLoan({ solveFor: "cuota", capital: 150_000, tipoAnual: 0.041, plazoAnios: 20 });
    expectOk(forward);

    const inverse = solveLoan({
      solveFor: "tipo",
      capital: 150_000,
      cuota: forward.cuota,
      plazoAnios: 20,
    });
    expectOk(inverse);
    expect(inverse.tipoAnual).toBeCloseTo(0.041, 5);
  });
});

describe("solveLoan — degenerate cases surface clear errors, never NaN", () => {
  it("rejects a payment that never covers interest (plazo)", () => {
    const result = solveLoan({ solveFor: "plazo", capital: 200_000, cuota: 50, tipoAnual: 0.03 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("nunca se amortizaría");
  });

  it("rejects a total paid that doesn't exceed capital (tipo)", () => {
    const result = solveLoan({ solveFor: "tipo", capital: 200_000, cuota: 500, plazoAnios: 20 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("no existe un tipo de interés positivo");
  });

  it("rejects negative or missing inputs instead of returning NaN", () => {
    expect(solveLoan({ solveFor: "cuota", capital: -100, tipoAnual: 0.03, plazoAnios: 20 }).ok).toBe(false);
    expect(solveLoan({ solveFor: "cuota", tipoAnual: 0.03, plazoAnios: 20 }).ok).toBe(false);
    expect(solveLoan({ solveFor: "capital", cuota: 500, tipoAnual: -0.01, plazoAnios: 20 }).ok).toBe(false);
  });

  it("handles the zero-rate case cleanly", () => {
    const result = solveLoan({ solveFor: "cuota", capital: 12_000, tipoAnual: 0, plazoAnios: 1 });
    expectOk(result);
    expect(result.cuota).toBeCloseTo(1000, 6);
    expect(result.primerPago.interes).toBe(0);
  });
});
