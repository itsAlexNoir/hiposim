/**
 * TAE (Tasa Anual Equivalente) — the honest cost-of-credit comparison.
 *
 * The contracted nominal rate (TIN) alone hides real costs: an opening fee
 * reduces what you actually receive, and a "bonificación" (payroll
 * deposit, home/life insurance, ...) that shaves the TIN often costs more
 * in mandatory annual premiums than the discount is worth. TAE fixes this
 * by computing the IRR over the *actual* cash flows — what you truly
 * receive net of upfront costs, against what you truly pay each month
 * including bonificación upkeep — then annualising it properly (effective
 * compounding, not `rate × 12`), exactly as Spanish/EU consumer-credit
 * regulation defines it.
 */
import { irr } from "./finance";

export interface Bonificacion {
  nombre: string;
  /** What maintaining this product costs per year (insurance premium, etc.) — a real cost, not the discount it earns. */
  costeAnual: number;
}

export interface TaeInput {
  /** Loan capital as agreed in the contract. */
  capitalRecibido: number;
  /** Upfront fee charged by the bank, e.g. 1% of capital. Reduces what is actually received. */
  comisionApertura?: number;
  /** Upfront valuation cost — paid by the buyer under Ley 5/2019, but it is still money spent to obtain the loan. */
  tasacion?: number;
  /**
   * Every monthly outflow to the lender, in order — normally
   * `schedule.filas.map(f => f.cuota + f.extra)` from schedule.ts, so
   * early repayments are counted as the real cash they are.
   */
  cuotas: number[];
  /** Products required to keep the contracted rate, each with its real annual cost. */
  bonificaciones?: Bonificacion[];
}

export interface TaeSuccess {
  ok: true;
  /** Effective annual rate — the number to compare across offers. */
  tae: number;
  /** Monthly IRR the TAE was compounded from. */
  tirMensual: number;
  costeBonificacionesAnual: number;
  costeBonificacionesTotal: number;
  netoRecibido: number;
}

export interface TaeFailure {
  ok: false;
  error: string;
}

export type TaeResult = TaeSuccess | TaeFailure;

/** Converts a periodic rate to its effective annual equivalent: (1+r)^n - 1. */
export function effectiveAnnualRate(periodicRateValue: number, periodsPerYear: number): number {
  return Math.pow(1 + periodicRateValue, periodsPerYear) - 1;
}

export function calcularTae(input: TaeInput): TaeResult {
  const { capitalRecibido, comisionApertura = 0, tasacion = 0, cuotas, bonificaciones = [] } = input;

  if (!Number.isFinite(capitalRecibido) || capitalRecibido <= 0) {
    return { ok: false, error: "El capital recibido debe ser positivo" };
  }
  if (cuotas.length === 0) {
    return { ok: false, error: "Se necesita al menos una cuota para calcular la TAE" };
  }

  const costeBonificacionesAnual = bonificaciones.reduce((sum, b) => sum + b.costeAnual, 0);
  const costeBonificacionesMensual = costeBonificacionesAnual / 12;

  const netoRecibido = capitalRecibido - comisionApertura - tasacion;
  if (netoRecibido <= 0) {
    return { ok: false, error: "La comisión de apertura y la tasación superan el capital recibido" };
  }

  const flujos = [netoRecibido, ...cuotas.map((c) => -(c + costeBonificacionesMensual))];

  try {
    const tirMensual = irr(flujos);
    return {
      ok: true,
      tae: effectiveAnnualRate(tirMensual, 12),
      tirMensual,
      costeBonificacionesAnual,
      costeBonificacionesTotal: costeBonificacionesMensual * cuotas.length,
      netoRecibido,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
