/**
 * Per-house economics: €/m², how it compares to its barrio's benchmark
 * price, and the total cost of ownership over a chosen horizon.
 */

export function calcularPrecioM2(precio: number, metrosCuadrados: number): number {
  if (metrosCuadrados <= 0) throw new RangeError("Los metros cuadrados deben ser positivos");
  return precio / metrosCuadrados;
}

export interface BenchmarkBarrio {
  precioM2: number;
  precioM2Barrio: number | null;
  /** (precioM2 - precioM2Barrio) / precioM2Barrio — positive means priced above the barrio's benchmark. */
  diferenciaPct: number | null;
}

export function compararConBarrio(precioM2: number, precioM2Barrio: number | null | undefined): BenchmarkBarrio {
  if (precioM2Barrio === null || precioM2Barrio === undefined || precioM2Barrio <= 0) {
    return { precioM2, precioM2Barrio: null, diferenciaPct: null };
  }
  return { precioM2, precioM2Barrio, diferenciaPct: (precioM2 - precioM2Barrio) / precioM2Barrio };
}

// ---------------------------------------------------------------------
// Coste total de propiedad (TCO)
// ---------------------------------------------------------------------

export interface CostesRecurrentesAnuales {
  /**
   * IBI depends on the valor catastral and the municipal tax rate
   * (typically ~0.4–0.6% of valor catastral/year in Salamanca capital) —
   * there is no safe universal default, so this defaults to 0 and should
   * be filled in per house once known.
   */
  ibi: number;
  /** Total anual de cuotas de comunidad (12 cuotas mensuales sumadas), no la cuota mensual. */
  comunidad: number;
  seguroHogar: number;
  mantenimiento: number;
}

export const DEFAULT_COSTES_RECURRENTES: CostesRecurrentesAnuales = {
  ibi: 0,
  comunidad: 0,
  seguroHogar: 250,
  mantenimiento: 0,
};

export interface TcoInput {
  entradaAportada: number;
  /** Impuestos + notaría + registro + gestoría + tasación — every non-recoverable upfront purchase cost. */
  costesCompra: number;
  /** Total interest paid over the horizon (from schedule.ts). */
  interesesPagados: number;
  costesRecurrentesAnuales: CostesRecurrentesAnuales;
  anios: number;
  /** Estimated market value of the house at the end of the horizon. */
  valorViviendaEstimado: number;
  /** Remaining mortgage balance at the end of the horizon. */
  saldoPendiente: number;
}

export interface TcoResultado {
  totalDesembolsado: number;
  /** valorViviendaEstimado - saldoPendiente — what the house is worth to you, net of what you still owe. */
  patrimonioNeto: number;
  /** totalDesembolsado - patrimonioNeto — the real cost of ownership; can be negative if the house appreciated enough. */
  costeRealNeto: number;
}

/**
 * Principal repaid is deliberately excluded from "cost" here — it's
 * forced saving, not an expense, and its effect is already captured via
 * `saldoPendiente` inside `patrimonioNeto`. Only interest, taxes/fees and
 * recurring costs count as real spend.
 */
export function calcularCosteTotalPropiedad(input: TcoInput): TcoResultado {
  const recurrentesAnual =
    input.costesRecurrentesAnuales.ibi +
    input.costesRecurrentesAnuales.comunidad +
    input.costesRecurrentesAnuales.seguroHogar +
    input.costesRecurrentesAnuales.mantenimiento;

  const totalDesembolsado =
    input.entradaAportada + input.costesCompra + input.interesesPagados + recurrentesAnual * input.anios;
  const patrimonioNeto = input.valorViviendaEstimado - input.saldoPendiente;

  return { totalDesembolsado, patrimonioNeto, costeRealNeto: totalDesembolsado - patrimonioNeto };
}
