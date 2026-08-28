import { describe, expect, it } from "vitest";
import { pmt, periodicRate } from "./finance";
import { calcularTae, effectiveAnnualRate, type TaeSuccess } from "./tae";

function expectOk(result: ReturnType<typeof calcularTae>): asserts result is TaeSuccess {
  if (!result.ok) throw new Error(`Expected ok, got error: ${result.error}`);
}

describe("effectiveAnnualRate", () => {
  it("matches simple compounding by hand for a round number", () => {
    // 1% monthly compounded 12 times: (1.01)^12 - 1 ≈ 12.6825%
    expect(effectiveAnnualRate(0.01, 12)).toBeCloseTo(0.126825, 6);
  });
});

describe("calcularTae — a plain loan with no fees", () => {
  it("TAE is close to the nominal rate's effective-annual equivalent", () => {
    const capital = 200_000;
    const tipoAnual = 0.03;
    const n = 300;
    const r = periodicRate(tipoAnual, 12);
    const cuota = pmt(r, n, capital);

    const result = calcularTae({ capitalRecibido: capital, cuotas: Array(n).fill(cuota) });
    expectOk(result);
    expect(result.tae).toBeCloseTo(effectiveAnnualRate(r, 12), 6);
    expect(result.costeBonificacionesTotal).toBe(0);
  });
});

describe("calcularTae — upfront costs push the TAE above the nominal rate", () => {
  it("an opening fee increases the TAE", () => {
    const capital = 200_000;
    const tipoAnual = 0.03;
    const n = 300;
    const r = periodicRate(tipoAnual, 12);
    const cuota = pmt(r, n, capital);
    const baseline = effectiveAnnualRate(r, 12);

    const result = calcularTae({
      capitalRecibido: capital,
      comisionApertura: capital * 0.01,
      cuotas: Array(n).fill(cuota),
    });
    expectOk(result);
    expect(result.tae).toBeGreaterThan(baseline);
  });

  it("tasación (valuation cost) also increases the TAE", () => {
    const capital = 200_000;
    const tipoAnual = 0.03;
    const n = 300;
    const r = periodicRate(tipoAnual, 12);
    const cuota = pmt(r, n, capital);
    const baseline = effectiveAnnualRate(r, 12);

    const result = calcularTae({ capitalRecibido: capital, tasacion: 350, cuotas: Array(n).fill(cuota) });
    expectOk(result);
    expect(result.tae).toBeGreaterThan(baseline);
  });
});

describe("calcularTae — the honest bonificación comparison", () => {
  it("a discounted rate whose required insurance costs more than it saves ends up MORE expensive", () => {
    const capital = 200_000;
    const n = 300;

    // Without bonificación: 3.00% TIN, no extra products.
    const rSinBonif = periodicRate(0.03, 12);
    const cuotaSinBonif = pmt(rSinBonif, n, capital);
    const sinBonif = calcularTae({ capitalRecibido: capital, cuotas: Array(n).fill(cuotaSinBonif) });
    expectOk(sinBonif);

    // With bonificación: 2.70% TIN (a real 0.30-point discount — cuota is
    // genuinely lower) but it requires an insurance product costing
    // €900/year, well above the ~€371/year the lower rate saves.
    const rConBonif = periodicRate(0.027, 12);
    const cuotaConBonif = pmt(rConBonif, n, capital);
    expect(cuotaConBonif).toBeLessThan(cuotaSinBonif); // the discount is real...
    const conBonif = calcularTae({
      capitalRecibido: capital,
      cuotas: Array(n).fill(cuotaConBonif),
      bonificaciones: [{ nombre: "Seguro de hogar obligatorio", costeAnual: 900 }],
    });
    expectOk(conBonif);

    // ...but once its mandatory cost is included, it is the worse deal.
    expect(conBonif.tae).toBeGreaterThan(sinBonif.tae);
  });

  it("a bonificación that costs less than it saves lowers the TAE", () => {
    const capital = 200_000;
    const n = 300;

    const rSinBonif = periodicRate(0.03, 12);
    const cuotaSinBonif = pmt(rSinBonif, n, capital);
    const sinBonif = calcularTae({ capitalRecibido: capital, cuotas: Array(n).fill(cuotaSinBonif) });
    expectOk(sinBonif);

    const rConBonif = periodicRate(0.027, 12);
    const cuotaConBonif = pmt(rConBonif, n, capital);
    const conBonif = calcularTae({
      capitalRecibido: capital,
      cuotas: Array(n).fill(cuotaConBonif),
      // Cheap enough to be worth it: well under the ~€371/year saved.
      bonificaciones: [{ nombre: "Seguro de vida barato", costeAnual: 100 }],
    });
    expectOk(conBonif);

    expect(conBonif.tae).toBeLessThan(sinBonif.tae);
  });
});

describe("calcularTae — degenerate cases", () => {
  it("rejects upfront costs that exceed the capital received", () => {
    const result = calcularTae({
      capitalRecibido: 1000,
      comisionApertura: 900,
      tasacion: 300,
      cuotas: [100, 100],
    });
    expect(result.ok).toBe(false);
  });

  it("rejects an empty cuotas array instead of computing garbage", () => {
    const result = calcularTae({ capitalRecibido: 1000, cuotas: [] });
    expect(result.ok).toBe(false);
  });
});
