/**
 * Financing limits and early-repayment penalty caps for the Spanish
 * mortgage market: how much a bank will typically lend (LTV), how much
 * cuota your income can typically support (DTI), and the legal maximum
 * a bank can charge for amortización anticipada under Ley 5/2019 (in
 * force again since 1 January 2025 after a 2022–2023 exemption window).
 *
 * These are market conventions and legal ceilings, not universal rules —
 * every value here is a sensible default the UI exposes as an editable
 * input, not a hard limit imposed on the user.
 */

// ---------------------------------------------------------------------
// LTV — how much a bank will typically lend
// ---------------------------------------------------------------------

export const LTV_MAXIMO_DEFECTO = 0.8;

export interface LimiteFinanciacion {
  /** min(precio, tasación) — the base the LTV percentage applies to. */
  baseFinanciable: number;
  prestamoMaximo: number;
  /** Cash needed beyond the loan: the entrada plus every purchase cost. */
  entradaMinima: number;
  ltvAplicado: number;
}

/**
 * `tasacion` defaults to `precio` when no formal valuation exists yet —
 * an approximation the UI should visibly flag until a real tasación is in.
 */
export function calcularLimiteFinanciacion(
  precio: number,
  tasacion: number = precio,
  costesCompra: number,
  ltvMaximoPct: number = LTV_MAXIMO_DEFECTO,
): LimiteFinanciacion {
  const baseFinanciable = Math.min(precio, tasacion);
  const prestamoMaximo = baseFinanciable * ltvMaximoPct;
  const entradaMinima = Math.max(precio - prestamoMaximo, 0) + costesCompra;
  return { baseFinanciable, prestamoMaximo, entradaMinima, ltvAplicado: ltvMaximoPct };
}

// ---------------------------------------------------------------------
// DTI — how much cuota your income can typically support
// ---------------------------------------------------------------------

export const DTI_MAXIMO_DEFECTO = 0.35;

export function calcularCuotaMaximaPorDti(
  ingresosNetosMensuales: number,
  deudaExistenteMensual: number = 0,
  dtiMaximoPct: number = DTI_MAXIMO_DEFECTO,
): number {
  return Math.max(ingresosNetosMensuales * dtiMaximoPct - deudaExistenteMensual, 0);
}

// ---------------------------------------------------------------------
// Veredicto de asequibilidad — combines LTV + DTI for one candidate loan
// ---------------------------------------------------------------------

export interface AsequibilidadInput {
  precio: number;
  tasacion?: number;
  costesCompra: number;
  capitalPrestamo: number;
  cuotaPropuesta: number;
  ingresosNetosMensuales: number;
  deudaExistenteMensual?: number;
  ltvMaximoPct?: number;
  dtiMaximoPct?: number;
}

export interface VeredictoAsequibilidad {
  cumpleLtv: boolean;
  cumpleDti: boolean;
  entradaNecesaria: number;
  prestamoMaximo: number;
  cuotaMaximaPorDti: number;
  /** Positive = headroom under the DTI cap; negative = over it by this much. */
  margenCuota: number;
}

export function evaluarAsequibilidad(input: AsequibilidadInput): VeredictoAsequibilidad {
  const limite = calcularLimiteFinanciacion(
    input.precio,
    input.tasacion ?? input.precio,
    input.costesCompra,
    input.ltvMaximoPct,
  );
  const cuotaMaximaPorDti = calcularCuotaMaximaPorDti(
    input.ingresosNetosMensuales,
    input.deudaExistenteMensual,
    input.dtiMaximoPct,
  );
  const EPS = 1e-6;
  return {
    cumpleLtv: input.capitalPrestamo <= limite.prestamoMaximo + EPS,
    cumpleDti: input.cuotaPropuesta <= cuotaMaximaPorDti + EPS,
    entradaNecesaria: limite.entradaMinima,
    prestamoMaximo: limite.prestamoMaximo,
    cuotaMaximaPorDti,
    margenCuota: cuotaMaximaPorDti - input.cuotaPropuesta,
  };
}

// ---------------------------------------------------------------------
// Comisión máxima por amortización anticipada (Ley 5/2019)
// ---------------------------------------------------------------------

export type TipoHipotecaPenalizacion = "fijo" | "variable";
/** Which of the two legal regimes the contract uses for variable-rate loans; the bank picks one at signing. */
export type RegimenVariable = "0.25-3anos" | "0.15-5anos";

export interface ComisionMaxima {
  porcentaje: number;
  /**
   * The legal ceiling only — the amount a bank actually charges is
   * capped further at its real financial loss (pérdida financiera), which
   * this module cannot compute (it depends on the bank's own funding
   * cost curve). Treat this as an upper bound, not a quote.
   */
  importeMaximoLegal: number;
  motivo: string;
}

export function comisionMaximaAmortizacionAnticipada(
  tipoHipoteca: TipoHipotecaPenalizacion,
  mesesTranscurridos: number,
  importeAmortizado: number,
  opts: { regimenVariable?: RegimenVariable } = {},
): ComisionMaxima {
  const anios = mesesTranscurridos / 12;

  if (tipoHipoteca === "fijo") {
    if (anios < 10) {
      return {
        porcentaje: 0.02,
        importeMaximoLegal: importeAmortizado * 0.02,
        motivo: "Hipoteca a tipo fijo, dentro de los primeros 10 años (máximo legal 2%)",
      };
    }
    return {
      porcentaje: 0.015,
      importeMaximoLegal: importeAmortizado * 0.015,
      motivo: "Hipoteca a tipo fijo, a partir del 10º año (máximo legal 1,5%)",
    };
  }

  const regimen = opts.regimenVariable ?? "0.25-3anos";
  if (regimen === "0.25-3anos") {
    if (anios < 3) {
      return {
        porcentaje: 0.0025,
        importeMaximoLegal: importeAmortizado * 0.0025,
        motivo: "Hipoteca variable, dentro de los primeros 3 años (máximo legal 0,25%)",
      };
    }
    return { porcentaje: 0, importeMaximoLegal: 0, motivo: "Sin coste legal a partir del 3er año" };
  }

  if (anios < 5) {
    return {
      porcentaje: 0.0015,
      importeMaximoLegal: importeAmortizado * 0.0015,
      motivo: "Hipoteca variable, dentro de los primeros 5 años (máximo legal 0,15%)",
    };
  }
  return { porcentaje: 0, importeMaximoLegal: 0, motivo: "Sin coste legal a partir del 5º año" };
}
