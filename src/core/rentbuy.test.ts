import { describe, expect, it } from "vitest";
import { DEFAULT_COSTES_RECURRENTES } from "./property";
import { compararAlquilarComprar, type RentBuyResultado } from "./rentbuy";

function expectOk(
  result: ReturnType<typeof compararAlquilarComprar>,
): asserts result is RentBuyResultado {
  if (!result.ok) throw new Error(`Expected ok, got error: ${result.error}`);
}

describe("compararAlquilarComprar — deterministic case (flat rent equal to buying's monthly cost)", () => {
  it("renter's portfolio is just the initial deposit compounded, when monthly costs are identical and rent doesn't grow", () => {
    const entradaAportada = 40_000;
    const costesCompra = 15_000;
    const cuotaHipotecaMensual = 800;
    const anios = 10;
    const rentabilidadInversionAnual = 0.04;

    const result = compararAlquilarComprar({
      anios,
      entradaAportada,
      costesCompra,
      cuotaHipotecaMensual,
      costesRecurrentesAnuales: DEFAULT_COSTES_RECURRENTES, // ibi/comunidad/mantenimiento = 0 by default
      valorViviendaEstimadoFinal: 250_000,
      saldoPendienteFinal: 120_000,
      alquilerMensualInicial: cuotaHipotecaMensual + DEFAULT_COSTES_RECURRENTES.seguroHogar / 12,
      crecimientoAlquilerAnual: 0,
      rentabilidadInversionAnual,
    });
    expectOk(result);

    const rMensual = Math.pow(1 + rentabilidadInversionAnual, 1 / 12) - 1;
    const esperado = (entradaAportada + costesCompra) * Math.pow(1 + rMensual, anios * 12);
    expect(result.patrimonioNetoAlquilando).toBeCloseTo(esperado, 2);
  });

  it("accumulates total rent paid correctly when rent doesn't grow", () => {
    const result = compararAlquilarComprar({
      anios: 5,
      entradaAportada: 10_000,
      costesCompra: 5_000,
      cuotaHipotecaMensual: 600,
      costesRecurrentesAnuales: DEFAULT_COSTES_RECURRENTES,
      valorViviendaEstimadoFinal: 200_000,
      saldoPendienteFinal: 150_000,
      alquilerMensualInicial: 700,
      crecimientoAlquilerAnual: 0,
    });
    expectOk(result);
    expect(result.costeTotalAlquilerAcumulado).toBeCloseTo(700 * 60, 6);
  });
});

describe("compararAlquilarComprar — directional sanity checks", () => {
  it("cheap rent + strong investment returns favours renting", () => {
    const result = compararAlquilarComprar({
      anios: 15,
      entradaAportada: 60_000,
      costesCompra: 15_000,
      cuotaHipotecaMensual: 900,
      costesRecurrentesAnuales: { ibi: 400, comunidad: 500, seguroHogar: 250, mantenimiento: 500 },
      valorViviendaEstimadoFinal: 260_000,
      saldoPendienteFinal: 100_000,
      alquilerMensualInicial: 500, // much cheaper than owning
      crecimientoAlquilerAnual: 0.01,
      rentabilidadInversionAnual: 0.07, // strong alternative returns
    });
    expectOk(result);
    expect(result.diferencia).toBeLessThan(0); // renting wins
  });

  it("expensive rent close to the mortgage cuota, with strong appreciation, favours buying", () => {
    const result = compararAlquilarComprar({
      anios: 15,
      entradaAportada: 60_000,
      costesCompra: 15_000,
      cuotaHipotecaMensual: 900,
      costesRecurrentesAnuales: { ibi: 300, comunidad: 300, seguroHogar: 200, mantenimiento: 200 },
      valorViviendaEstimadoFinal: 400_000, // strong appreciation
      saldoPendienteFinal: 100_000,
      alquilerMensualInicial: 950, // renting isn't meaningfully cheaper
      crecimientoAlquilerAnual: 0.03,
      rentabilidadInversionAnual: 0.02, // weak alternative returns
    });
    expectOk(result);
    expect(result.diferencia).toBeGreaterThan(0); // buying wins
  });
});

describe("compararAlquilarComprar — degenerate cases", () => {
  it("rejects a non-positive horizon", () => {
    const result = compararAlquilarComprar({
      anios: 0,
      entradaAportada: 10_000,
      costesCompra: 5_000,
      cuotaHipotecaMensual: 600,
      costesRecurrentesAnuales: DEFAULT_COSTES_RECURRENTES,
      valorViviendaEstimadoFinal: 200_000,
      saldoPendienteFinal: 150_000,
      alquilerMensualInicial: 700,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects negative rent", () => {
    const result = compararAlquilarComprar({
      anios: 5,
      entradaAportada: 10_000,
      costesCompra: 5_000,
      cuotaHipotecaMensual: 600,
      costesRecurrentesAnuales: DEFAULT_COSTES_RECURRENTES,
      valorViviendaEstimadoFinal: 200_000,
      saldoPendienteFinal: 150_000,
      alquilerMensualInicial: -100,
    });
    expect(result.ok).toBe(false);
  });
});
