/**
 * Rent vs buy — the standard "rent and invest the difference" model.
 *
 * Buying ties up the entrada + purchase costs in the house immediately.
 * Renting instead means that money can be invested from day one, and
 * every month the difference between what buying would have cost
 * (cuota + recurring costs) and the actual rent — positive or negative —
 * is added to (or drawn from) that same investment. After N years, the
 * comparison is buyer's net worth (house value minus remaining mortgage)
 * against renter's net worth (the investment portfolio).
 */
import type { CostesRecurrentesAnuales } from "./property";

export interface RentBuyInput {
  anios: number;

  // Comprando:
  entradaAportada: number;
  costesCompra: number;
  cuotaHipotecaMensual: number;
  costesRecurrentesAnuales: CostesRecurrentesAnuales;
  valorViviendaEstimadoFinal: number;
  saldoPendienteFinal: number;

  // Alquilando:
  alquilerMensualInicial: number;
  /** Annual rent growth, e.g. 0.02 for 2%/year. Defaults to 2%. */
  crecimientoAlquilerAnual?: number;
  /** Annual return on the money not spent on a down payment, invested elsewhere. Defaults to 4%. */
  rentabilidadInversionAnual?: number;
}

export interface RentBuyResultado {
  ok: true;
  patrimonioNetoComprando: number;
  patrimonioNetoAlquilando: number;
  /** comprando - alquilando: positive means buying left you better off. */
  diferencia: number;
  costeTotalAlquilerAcumulado: number;
}

export interface RentBuyFailure {
  ok: false;
  error: string;
}

export function compararAlquilarComprar(input: RentBuyInput): RentBuyResultado | RentBuyFailure {
  if (!Number.isFinite(input.anios) || input.anios <= 0) {
    return { ok: false, error: "El horizonte temporal debe ser mayor que 0 años" };
  }
  if (input.alquilerMensualInicial < 0) {
    return { ok: false, error: "El alquiler mensual no puede ser negativo" };
  }

  const nMeses = Math.round(input.anios * 12);
  const rentabilidadAnual = input.rentabilidadInversionAnual ?? 0.04;
  const crecimientoAlquilerAnual = input.crecimientoAlquilerAnual ?? 0.02;
  const rMensualInversion = Math.pow(1 + rentabilidadAnual, 1 / 12) - 1;
  const crecimientoAlquilerMensual = Math.pow(1 + crecimientoAlquilerAnual, 1 / 12) - 1;

  const recurrentesMensual =
    (input.costesRecurrentesAnuales.ibi +
      input.costesRecurrentesAnuales.comunidad +
      input.costesRecurrentesAnuales.seguroHogar +
      input.costesRecurrentesAnuales.mantenimiento) /
    12;

  let carteraAlquilando = input.entradaAportada + input.costesCompra;
  let alquilerMensual = input.alquilerMensualInicial;
  let costeTotalAlquilerAcumulado = 0;

  for (let mes = 1; mes <= nMeses; mes++) {
    carteraAlquilando *= 1 + rMensualInversion;
    const gastoComprando = input.cuotaHipotecaMensual + recurrentesMensual;
    carteraAlquilando += gastoComprando - alquilerMensual;
    costeTotalAlquilerAcumulado += alquilerMensual;
    alquilerMensual *= 1 + crecimientoAlquilerMensual;
  }

  const patrimonioNetoComprando = input.valorViviendaEstimadoFinal - input.saldoPendienteFinal;

  return {
    ok: true,
    patrimonioNetoComprando,
    patrimonioNetoAlquilando: carteraAlquilando,
    diferencia: patrimonioNetoComprando - carteraAlquilando,
    costeTotalAlquilerAcumulado,
  };
}
