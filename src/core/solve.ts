/**
 * The four-way loan solver: given any three of {capital, cuota, plazo,
 * tipo}, solves for the fourth. This generalises the seed spreadsheet
 * (which only ever computes cuota from the other three) to the case you
 * actually want to explore first: "I can pay €X/month — what can I
 * borrow, and how is the first payment split?"
 *
 * Returns a discriminated result rather than throwing, so it is safe to
 * call from render-time selectors (Zustand) without a try/catch at every
 * call site — a bad input becomes a typed, Spanish-language error message
 * instead of a crash or a silent NaN.
 */
import { ipmt, periodicRate, ppmt, pmt, pv, nper, rateFromPayment } from "./finance";

export type SolveFor = "capital" | "cuota" | "plazo" | "tipo";

export interface SolveInput {
  solveFor: SolveFor;
  /** Loan amount. Required unless solveFor === "capital". */
  capital?: number;
  /** Monthly payment. Required unless solveFor === "cuota". */
  cuota?: number;
  /** Term in years. Required unless solveFor === "plazo". */
  plazoAnios?: number;
  /** Annual nominal rate (e.g. 0.035 for 3.5%). Required unless solveFor === "tipo". */
  tipoAnual?: number;
}

export interface FirstPaymentBreakdown {
  interes: number;
  principal: number;
}

export interface SolveSuccess {
  ok: true;
  capital: number;
  cuota: number;
  tipoAnual: number;
  tipoMensual: number;
  /**
   * Exact (possibly fractional) number of monthly payments implied by the
   * maths. Only fractional when solveFor === "plazo" — every other mode
   * derives from an integer plazoAnios*12.
   */
  plazoMesesExacto: number;
  /** Real-world number of instalments (ceil of the exact value) — feed this to schedule.ts. */
  plazoMeses: number;
  plazoAnios: number;
  /**
   * costeTotal/interesesTotal use the exact fractional term, so for
   * solveFor === "plazo" they can differ very slightly from what
   * schedule.ts computes (which prorates a smaller final instalment
   * instead of a fractional one). Both are correct; schedule.ts is the
   * source of truth once a concrete amortization table is needed.
   */
  costeTotal: number;
  interesesTotal: number;
  primerPago: FirstPaymentBreakdown;
}

export interface SolveFailure {
  ok: false;
  error: string;
}

export type SolveResult = SolveSuccess | SolveFailure;

function describeError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (message === "payment-too-small") {
    return "La cuota introducida no cubre ni siquiera los intereses del primer pago: el préstamo nunca se amortizaría. Sube la cuota o el capital, o baja el tipo o el plazo.";
  }
  return message;
}

function requirePositive(value: number | undefined, label: string): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} debe ser un número positivo`);
  }
  return value;
}

function requireNonNegativeRate(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value) || value < 0) {
    throw new RangeError("El tipo de interés anual no puede ser negativo");
  }
  return value;
}

function finish(capital: number, cuota: number, nMesesExacto: number, tipoAnual: number): SolveSuccess {
  const tipoMensual = periodicRate(tipoAnual, 12);
  const plazoMeses = Math.ceil(nMesesExacto - 1e-9); // tolerate float fuzz landing just above an integer
  const costeTotal = cuota * nMesesExacto;
  return {
    ok: true,
    capital,
    cuota,
    tipoAnual,
    tipoMensual,
    plazoMesesExacto: nMesesExacto,
    plazoMeses,
    plazoAnios: plazoMeses / 12,
    costeTotal,
    interesesTotal: costeTotal - capital,
    primerPago: {
      interes: ipmt(tipoMensual, 1, nMesesExacto, capital),
      principal: ppmt(tipoMensual, 1, nMesesExacto, capital),
    },
  };
}

export function solveLoan(input: SolveInput): SolveResult {
  try {
    switch (input.solveFor) {
      case "capital": {
        // Your "set the monthly payment, get the amount you can borrow" case.
        const cuota = requirePositive(input.cuota, "La cuota");
        const plazoAnios = requirePositive(input.plazoAnios, "El plazo");
        const tipoAnual = requireNonNegativeRate(input.tipoAnual);
        const n = plazoAnios * 12;
        const r = periodicRate(tipoAnual, 12);
        const capital = pv(r, n, cuota);
        return finish(capital, cuota, n, tipoAnual);
      }

      case "cuota": {
        const capital = requirePositive(input.capital, "El capital");
        const plazoAnios = requirePositive(input.plazoAnios, "El plazo");
        const tipoAnual = requireNonNegativeRate(input.tipoAnual);
        const n = plazoAnios * 12;
        const r = periodicRate(tipoAnual, 12);
        const cuota = pmt(r, n, capital);
        return finish(capital, cuota, n, tipoAnual);
      }

      case "plazo": {
        const capital = requirePositive(input.capital, "El capital");
        const cuota = requirePositive(input.cuota, "La cuota");
        const tipoAnual = requireNonNegativeRate(input.tipoAnual);
        const r = periodicRate(tipoAnual, 12);
        const n = nper(r, cuota, capital); // throws "payment-too-small" if it never amortizes
        return finish(capital, cuota, n, tipoAnual);
      }

      case "tipo": {
        const capital = requirePositive(input.capital, "El capital");
        const cuota = requirePositive(input.cuota, "La cuota");
        const plazoAnios = requirePositive(input.plazoAnios, "El plazo");
        const n = plazoAnios * 12;
        if (cuota * n <= capital) {
          throw new RangeError(
            "El total pagado (cuota × número de pagos) no supera el capital: no existe un tipo de interés positivo que explique esos datos. Sube la cuota o el plazo.",
          );
        }
        const r = rateFromPayment(n, cuota, capital);
        return finish(capital, cuota, n, r * 12);
      }
    }
  } catch (err) {
    return { ok: false, error: describeError(err) };
  }
}
