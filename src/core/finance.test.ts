import { describe, expect, it } from "vitest";
import {
  balanceAfter,
  ipmt,
  irr,
  nper,
  periodicRate,
  pmt,
  ppmt,
  pv,
  rateFromPayment,
} from "./finance";

// Golden values read directly from the seed spreadsheet's stored cell
// results ("Calculadora de préstamos simple y tabla de amortización.xlsx"):
// D3=5000 (importe), D4=5.5% (tasa anual), D5=5 (años).
const CAPITAL = 5000;
const ANNUAL_RATE = 0.055;
const YEARS = 5;
const N = YEARS * 12;
const R = periodicRate(ANNUAL_RATE, 12);

describe("finance primitives — golden values from the seed spreadsheet", () => {
  it("matches Pago_Mensual = -PMT(...)", () => {
    expect(pmt(R, N, CAPITAL)).toBeCloseTo(95.5058108589112, 9);
  });

  it("matches Coste_Total = Pago_Mensual * Número_De_Pagos", () => {
    expect(pmt(R, N, CAPITAL) * N).toBeCloseTo(5730.348651534672, 6);
  });

  it("matches Intereses_Total = Costo_Total - Cantidad_De_Préstamo", () => {
    expect(pmt(R, N, CAPITAL) * N - CAPITAL).toBeCloseTo(730.3486515346722, 6);
  });

  it("matches Interés (payment 1) = -IPMT(rate, 1, nper, pv)", () => {
    expect(ipmt(R, 1, N, CAPITAL)).toBeCloseTo(22.916666666666668, 9);
  });

  it("matches Principal (payment 1) = -PPMT(rate, 1, nper, pv)", () => {
    expect(ppmt(R, 1, N, CAPITAL)).toBeCloseTo(72.58914419224453, 6);
  });

  it("matches Saldo_Final (payment 1) = -FV(rate, 1, -pmt, pv)", () => {
    expect(balanceAfter(R, 1, N, CAPITAL)).toBeCloseTo(4927.410855807755, 6);
  });

  it("matches payment 2's full row", () => {
    // B15..H15 in the sheet
    expect(balanceAfter(R, 1, N, CAPITAL)).toBeCloseTo(4927.410855807755, 6); // saldo inicial
    expect(ppmt(R, 2, N, CAPITAL)).toBeCloseTo(72.921844436459, 6);
    expect(ipmt(R, 2, N, CAPITAL)).toBeCloseTo(22.58396642245221, 6);
    expect(balanceAfter(R, 2, N, CAPITAL)).toBeCloseTo(4854.489011371295, 6);
  });

  it("the schedule fully amortizes: balance after all N payments is ~0", () => {
    expect(balanceAfter(R, N, N, CAPITAL)).toBeCloseTo(0, 6);
  });
});

describe("pv — the 'set payment, get loan amount' inverse of pmt", () => {
  it("round-trips pmt", () => {
    const payment = pmt(R, N, CAPITAL);
    expect(pv(R, N, payment)).toBeCloseTo(CAPITAL, 6);
  });

  it("round-trips across a grid of rates and terms", () => {
    for (const annual of [0, 0.005, 0.03, 0.12]) {
      for (const years of [5, 15, 25, 40]) {
        const r = periodicRate(annual, 12);
        const n = years * 12;
        const payment = pmt(r, n, CAPITAL);
        expect(pv(r, n, payment)).toBeCloseTo(CAPITAL, 5);
      }
    }
  });
});

describe("nper — round-trips pmt/pv", () => {
  it("recovers the term for the golden scenario", () => {
    const payment = pmt(R, N, CAPITAL);
    expect(nper(R, payment, CAPITAL)).toBeCloseTo(N, 4);
  });

  it("throws when the payment never covers interest (never amortizes)", () => {
    const interestOnly = CAPITAL * R;
    expect(() => nper(R, interestOnly * 0.5, CAPITAL)).toThrow();
  });

  it("handles the zero-rate case as plain division", () => {
    expect(nper(0, 100, 1200)).toBeCloseTo(12, 9);
  });
});

describe("rateFromPayment — no closed form, Newton + bisection", () => {
  it("recovers the golden scenario's rate", () => {
    const payment = pmt(R, N, CAPITAL);
    expect(rateFromPayment(N, payment, CAPITAL)).toBeCloseTo(R, 6);
  });

  it("round-trips across a grid of rates and terms", () => {
    for (const annual of [0.005, 0.01, 0.03, 0.08, 0.15]) {
      for (const years of [5, 15, 25, 40]) {
        const r = periodicRate(annual, 12);
        const n = years * 12;
        const payment = pmt(r, n, CAPITAL);
        expect(rateFromPayment(n, payment, CAPITAL)).toBeCloseTo(r, 6);
      }
    }
  });
});

describe("irr — used by TAE", () => {
  it("recovers the flat rate for a plain loan with no fees", () => {
    const payment = pmt(R, N, CAPITAL);
    const cashflows = [CAPITAL, ...Array(N).fill(-payment)];
    expect(irr(cashflows)).toBeCloseTo(R, 6);
  });

  it("returns a higher rate when an opening fee reduces the amount received", () => {
    const payment = pmt(R, N, CAPITAL);
    const openingFee = 100;
    const cashflows = [CAPITAL - openingFee, ...Array(N).fill(-payment)];
    expect(irr(cashflows)).toBeGreaterThan(R);
  });
});
