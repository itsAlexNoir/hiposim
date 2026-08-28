import { describe, expect, it } from "vitest";
import { pmt } from "./finance";
import { generateSchedule, type ScheduleSuccess } from "./schedule";

function expectOk(result: ReturnType<typeof generateSchedule>): asserts result is ScheduleSuccess {
  if (!result.ok) throw new Error(`Expected ok, got error: ${result.error}`);
}

const GOLDEN_START = new Date(Date.UTC(2023, 3, 1)); // arbitrary — sheet used TODAY(), dates aren't part of the golden check

describe("generateSchedule — fixed rate reproduces the seed spreadsheet", () => {
  it("matches the first two rows exactly", () => {
    const result = generateSchedule({
      capital: 5000,
      plazoMeses: 60,
      fechaInicio: GOLDEN_START,
      tasa: { tipo: "fijo", tipoAnual: 0.055 },
    });
    expectOk(result);

    const [row1, row2] = result.filas;
    expect(row1.saldoInicial).toBeCloseTo(5000, 6);
    expect(row1.cuota).toBeCloseTo(95.5058108589112, 6);
    expect(row1.interes).toBeCloseTo(22.916666666666668, 6);
    expect(row1.principal).toBeCloseTo(72.58914419224453, 4);
    expect(row1.saldoFinal).toBeCloseTo(4927.410855807755, 4);

    expect(row2.saldoInicial).toBeCloseTo(4927.410855807755, 4);
    expect(row2.principal).toBeCloseTo(72.921844436459, 4);
    expect(row2.interes).toBeCloseTo(22.58396642245221, 4);
    expect(row2.saldoFinal).toBeCloseTo(4854.489011371295, 4);
  });

  it("fully amortizes: 60 rows, balance ends at 0, totals reconcile", () => {
    const result = generateSchedule({
      capital: 5000,
      plazoMeses: 60,
      fechaInicio: GOLDEN_START,
      tasa: { tipo: "fijo", tipoAnual: 0.055 },
    });
    expectOk(result);
    expect(result.mesesReales).toBe(60);
    expect(result.filas.at(-1)!.saldoFinal).toBe(0);

    const sumPrincipal = result.filas.reduce((s, r) => s + r.principal, 0);
    expect(sumPrincipal).toBeCloseTo(5000, 4);
    expect(result.interesesTotal).toBeCloseTo(730.3486515346722, 3);
    expect(result.costeTotal).toBeCloseTo(5730.348651534672, 3);
  });

  it("closes cleanly across a grid of rates and terms", () => {
    for (const tipoAnual of [0, 0.01, 0.035, 0.12]) {
      for (const years of [5, 15, 25, 40]) {
        const result = generateSchedule({
          capital: 200_000,
          plazoMeses: years * 12,
          fechaInicio: GOLDEN_START,
          tasa: { tipo: "fijo", tipoAnual },
        });
        expectOk(result);
        expect(result.mesesReales).toBe(years * 12);
        expect(result.filas.at(-1)!.saldoFinal).toBe(0);
        const sumPrincipal = result.filas.reduce((s, r) => s + r.principal, 0);
        expect(sumPrincipal).toBeCloseTo(200_000, 2);
      }
    }
  });

  it("finds a crossover month where principal first exceeds interest", () => {
    const result = generateSchedule({
      capital: 200_000,
      plazoMeses: 300,
      fechaInicio: GOLDEN_START,
      tasa: { tipo: "fijo", tipoAnual: 0.035 },
    });
    expectOk(result);
    expect(result.mesCruce).not.toBeNull();
    expect(result.mesCruce!).toBeGreaterThan(1);
    expect(result.mesCruce!).toBeLessThan(300);
    const row = result.filas[result.mesCruce! - 1];
    expect(row.principal).toBeGreaterThan(row.interes);
    const prevRow = result.filas[result.mesCruce! - 2];
    expect(prevRow.principal).toBeLessThanOrEqual(prevRow.interes);
  });
});

describe("generateSchedule — carencia (grace period)", () => {
  it("carencia parcial: interest-only, balance unchanged during grace", () => {
    const result = generateSchedule({
      capital: 100_000,
      plazoMeses: 240,
      fechaInicio: GOLDEN_START,
      tasa: { tipo: "fijo", tipoAnual: 0.04 },
      carencia: { meses: 6, tipo: "parcial" },
    });
    expectOk(result);
    for (let i = 0; i < 6; i++) {
      const row = result.filas[i];
      expect(row.principal).toBe(0);
      expect(row.saldoFinal).toBeCloseTo(row.saldoInicial, 6);
      expect(row.cuota).toBeCloseTo(row.interes, 6);
    }
    // Balance is still exactly the original capital when grace ends.
    expect(result.filas[5].saldoFinal).toBeCloseTo(100_000, 6);
    // After grace, a real cuota resumes and starts paying down principal.
    expect(result.filas[6].principal).toBeGreaterThan(0);
  });

  it("carencia total: nothing paid, interest capitalizes and grows the balance", () => {
    const result = generateSchedule({
      capital: 100_000,
      plazoMeses: 240,
      fechaInicio: GOLDEN_START,
      tasa: { tipo: "fijo", tipoAnual: 0.04 },
      carencia: { meses: 6, tipo: "total" },
    });
    expectOk(result);
    for (let i = 0; i < 6; i++) {
      expect(result.filas[i].cuota).toBe(0);
      expect(result.filas[i].saldoFinal).toBeGreaterThan(result.filas[i].saldoInicial);
    }
    // Balance after grace exceeds the original capital.
    expect(result.filas[5].saldoFinal).toBeGreaterThan(100_000);
    // Loan still fully amortizes by the end.
    expect(result.filas.at(-1)!.saldoFinal).toBe(0);
  });

  it("rejects a carencia that is not shorter than the term", () => {
    const result = generateSchedule({
      capital: 100_000,
      plazoMeses: 12,
      fechaInicio: GOLDEN_START,
      tasa: { tipo: "fijo", tipoAnual: 0.04 },
      carencia: { meses: 12, tipo: "parcial" },
    });
    expect(result.ok).toBe(false);
  });
});

describe("generateSchedule — variable and mixed rates", () => {
  it("variable: cuota recomputes at each revision using the new Euríbor", () => {
    const result = generateSchedule({
      capital: 150_000,
      plazoMeses: 300,
      fechaInicio: GOLDEN_START,
      tasa: {
        tipo: "variable",
        diferencial: 0.006,
        euriborActual: 0.03,
        frecuenciaRevisionMeses: 12,
        euriborProyectado: (idx) => [0.03, 0.05, 0.01][idx] ?? 0.03,
      },
    });
    expectOk(result);
    const cuotaAno1 = result.filas[0].cuota;
    const cuotaAno2 = result.filas[12].cuota; // first month of revision index 1 (5% euribor -> higher rate -> higher cuota)
    const cuotaAno3 = result.filas[24].cuota; // revision index 2 (1% euribor -> lower rate -> lower cuota)
    expect(result.filas[0].esRevision).toBe(true);
    expect(result.filas[12].esRevision).toBe(true);
    expect(cuotaAno2).toBeGreaterThan(cuotaAno1);
    expect(cuotaAno3).toBeLessThan(cuotaAno2);
    expect(result.filas.at(-1)!.saldoFinal).toBe(0);
  });

  it("mixto: fixed for the initial years, then switches to variable", () => {
    const result = generateSchedule({
      capital: 150_000,
      plazoMeses: 300,
      fechaInicio: GOLDEN_START,
      tasa: {
        tipo: "mixto",
        aniosFijo: 5,
        tipoFijoAnual: 0.025,
        variable: { diferencial: 0.006, euriborActual: 0.03, frecuenciaRevisionMeses: 12 },
      },
    });
    expectOk(result);
    // Fixed segment: same rate every month for 60 months, no revisions after month 1.
    for (let i = 0; i < 60; i++) {
      expect(result.filas[i].tipoAnualVigente).toBeCloseTo(0.025, 9);
    }
    expect(result.filas[60].esRevision).toBe(true); // first month of the variable segment
    expect(result.filas[60].tipoAnualVigente).toBeCloseTo(0.036, 9); // 0.03 + 0.006
    expect(result.filas.at(-1)!.saldoFinal).toBe(0);
  });
});

describe("generateSchedule — amortización anticipada", () => {
  it("reducirPlazo: a lump sum finishes the loan earlier than contracted, same cuota", () => {
    const plazoMeses = 240;
    const base = generateSchedule({
      capital: 150_000,
      plazoMeses,
      fechaInicio: GOLDEN_START,
      tasa: { tipo: "fijo", tipoAnual: 0.035 },
    });
    expectOk(base);

    const result = generateSchedule({
      capital: 150_000,
      plazoMeses,
      fechaInicio: GOLDEN_START,
      tasa: { tipo: "fijo", tipoAnual: 0.035 },
      amortizacionesAnticipadas: [{ tipo: "unica", mes: 12, importe: 20_000, modo: "reducirPlazo" }],
    });
    expectOk(result);

    expect(result.mesesReales).toBeLessThan(plazoMeses);
    expect(result.filas[11].extra).toBe(20_000);
    // cuota is unchanged by a reducirPlazo amortization
    expect(result.filas[15].cuota).toBeCloseTo(base.filas[15].cuota, 6);
    // and total interest paid drops versus the base case
    expect(result.interesesTotal).toBeLessThan(base.interesesTotal);
  });

  it("reducirPlazo survives a variable-rate revision instead of being silently absorbed into a lower cuota", () => {
    // Regression test: a periodic rate revision used to always recompute
    // the cuota to fit the ORIGINAL contracted maturity date, which wiped
    // out any term shortening a reducirPlazo payment had just achieved —
    // turning it into a de facto reducirCuota the moment the next
    // revision hit. See the `plazoMesesEfectivo` tracking in schedule.ts.
    const plazoMeses = 300;
    const tasa = {
      tipo: "variable" as const,
      diferencial: 0.006,
      euriborActual: 0.03,
      frecuenciaRevisionMeses: 12 as const,
    };
    const base = generateSchedule({ capital: 160_000, plazoMeses, fechaInicio: GOLDEN_START, tasa });
    expectOk(base);

    // A reducirPlazo lump sum at month 12, right before the month-13 revision.
    const result = generateSchedule({
      capital: 160_000,
      plazoMeses,
      fechaInicio: GOLDEN_START,
      tasa,
      amortizacionesAnticipadas: [{ tipo: "unica", mes: 12, importe: 5_000, modo: "reducirPlazo" }],
    });
    expectOk(result);

    // The term must actually shorten, not just the balance/interest.
    expect(result.mesesReales).toBeLessThan(base.mesesReales);
    // And the cuota right after the revision must NOT have been quietly
    // lowered to reabsorb the extra payment into the original maturity.
    expect(result.filas[13].cuota).toBeCloseTo(base.filas[13].cuota, 2);
  });

  it("reducirCuota: a lump sum lowers the cuota, term stays close to contracted", () => {
    const plazoMeses = 240;
    const base = generateSchedule({
      capital: 150_000,
      plazoMeses,
      fechaInicio: GOLDEN_START,
      tasa: { tipo: "fijo", tipoAnual: 0.035 },
    });
    expectOk(base);

    const result = generateSchedule({
      capital: 150_000,
      plazoMeses,
      fechaInicio: GOLDEN_START,
      tasa: { tipo: "fijo", tipoAnual: 0.035 },
      amortizacionesAnticipadas: [{ tipo: "unica", mes: 12, importe: 20_000, modo: "reducirCuota" }],
    });
    expectOk(result);

    expect(result.filas[12].cuota).toBeLessThan(base.filas[12].cuota);
    expect(result.interesesTotal).toBeLessThan(base.interesesTotal);
  });

  it("a recurring extra payment compounds every period it applies", () => {
    const result = generateSchedule({
      capital: 150_000,
      plazoMeses: 240,
      fechaInicio: GOLDEN_START,
      tasa: { tipo: "fijo", tipoAnual: 0.035 },
      amortizacionesAnticipadas: [
        { tipo: "recurrente", mes: 1, importe: 100, frecuenciaMeses: 1, modo: "reducirPlazo" },
      ],
    });
    expectOk(result);
    // Every row gets the extra €100, except possibly the final one where the
    // remaining balance is smaller than €100 and the extra is clipped to it.
    result.filas.slice(0, -1).forEach((r) => expect(r.extra).toBe(100));
    expect(result.filas.at(-1)!.extra).toBeGreaterThan(0);
    expect(result.filas.at(-1)!.extra).toBeLessThanOrEqual(100);
    expect(result.mesesReales).toBeLessThan(240);
  });

  it("never over-amortizes past the remaining balance", () => {
    const result = generateSchedule({
      capital: 5000,
      plazoMeses: 24,
      fechaInicio: GOLDEN_START,
      tasa: { tipo: "fijo", tipoAnual: 0.03 },
      amortizacionesAnticipadas: [{ tipo: "unica", mes: 1, importe: 999_999, modo: "reducirPlazo" }],
    });
    expectOk(result);
    expect(result.filas.every((r) => r.saldoFinal >= 0)).toBe(true);
    expect(result.mesesReales).toBe(1);
  });
});

describe("generateSchedule — degenerate cases", () => {
  it("rejects non-positive capital or plazo", () => {
    expect(
      generateSchedule({
        capital: 0,
        plazoMeses: 12,
        fechaInicio: GOLDEN_START,
        tasa: { tipo: "fijo", tipoAnual: 0.03 },
      }).ok,
    ).toBe(false);
    expect(
      generateSchedule({
        capital: 1000,
        plazoMeses: 0,
        fechaInicio: GOLDEN_START,
        tasa: { tipo: "fijo", tipoAnual: 0.03 },
      }).ok,
    ).toBe(false);
  });

  it("cross-checks against a direct pmt() call for a plain fixed loan", () => {
    const capital = 175_000;
    const tipoAnual = 0.028;
    const plazoMeses = 300;
    const expectedCuota = pmt(tipoAnual / 12, plazoMeses, capital);
    const result = generateSchedule({
      capital,
      plazoMeses,
      fechaInicio: GOLDEN_START,
      tasa: { tipo: "fijo", tipoAnual },
    });
    expectOk(result);
    expect(result.filas[0].cuota).toBeCloseTo(expectedCuota, 6);
  });
});
