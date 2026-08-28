/**
 * Row-by-row amortization schedule generator. Builds on finance.ts's
 * primitives but, unlike solve.ts (a single closed-form calculation),
 * walks month by month so it can model everything the spreadsheet can't:
 * fixed/variable/mixed rates with periodic revisions, carencia (grace
 * periods), and amortización anticipada (early lump-sum or recurring
 * extra repayments).
 *
 * Returns a discriminated result — never throws — for the same reason as
 * solve.ts: safe to call from render-time selectors.
 */
import { nper, periodicRate, pmt } from "./finance";

// ---------------------------------------------------------------------
// Rate configuration
// ---------------------------------------------------------------------

export interface TasaFija {
  tipo: "fijo";
  tipoAnual: number;
}

export interface RevisionVariable {
  /** Differential added to Euribor, e.g. 0.0060 for "Euríbor + 0,60%". */
  diferencial: number;
  /** Current Euríbor (annual), used for every revision unless euriborProyectado overrides it. */
  euriborActual: number;
  frecuenciaRevisionMeses: 6 | 12;
  /**
   * Optional projection for stress-testing: given the revision index
   * (0, 1, 2, ...) returns the annual Euríbor to use at that revision.
   * Omit to hold euriborActual constant for the whole loan.
   */
  euriborProyectado?: (revisionIndex: number) => number;
}

export interface TasaVariable extends RevisionVariable {
  tipo: "variable";
}

export interface TasaMixta {
  tipo: "mixto";
  aniosFijo: number;
  tipoFijoAnual: number;
  variable: RevisionVariable;
}

export type TasaConfig = TasaFija | TasaVariable | TasaMixta;

// ---------------------------------------------------------------------
// Carencia (grace period)
// ---------------------------------------------------------------------

export interface CarenciaConfig {
  meses: number;
  /** parcial = pay interest only, balance unchanged. total = pay nothing, interest capitalizes onto the balance. */
  tipo: "parcial" | "total";
}

// ---------------------------------------------------------------------
// Amortización anticipada (early repayment)
// ---------------------------------------------------------------------

export interface AmortizacionUnica {
  tipo: "unica";
  mes: number;
  importe: number;
  modo: "reducirCuota" | "reducirPlazo";
}

export interface AmortizacionRecurrente {
  tipo: "recurrente";
  /** First month it applies. */
  mes: number;
  importe: number;
  frecuenciaMeses: number;
  modo: "reducirCuota" | "reducirPlazo";
}

export type AmortizacionAnticipada = AmortizacionUnica | AmortizacionRecurrente;

// ---------------------------------------------------------------------
// Input / output
// ---------------------------------------------------------------------

export interface ScheduleInput {
  capital: number;
  /** Contracted term in months — the maturity date variable-rate revisions recompute towards. */
  plazoMeses: number;
  fechaInicio: Date;
  tasa: TasaConfig;
  carencia?: CarenciaConfig;
  amortizacionesAnticipadas?: AmortizacionAnticipada[];
}

export interface ScheduleRow {
  n: number;
  fecha: string; // ISO date (yyyy-mm-dd)
  saldoInicial: number;
  tipoAnualVigente: number;
  cuota: number;
  interes: number;
  principal: number;
  extra: number;
  saldoFinal: number;
  esRevision: boolean;
  esCarencia: boolean;
}

export interface ScheduleSuccess {
  ok: true;
  filas: ScheduleRow[];
  /** Actual number of rows generated — can be less than plazoMeses if reducirPlazo or anticipada finish the loan early. */
  mesesReales: number;
  costeTotal: number;
  interesesTotal: number;
  /** First month where the principal portion exceeds the interest portion; null if it never does (e.g. a schedule that is entirely carencia). */
  mesCruce: number | null;
  fechaFin: string;
}

export interface ScheduleFailure {
  ok: false;
  error: string;
}

export type ScheduleResult = ScheduleSuccess | ScheduleFailure;

// ---------------------------------------------------------------------
// Rate schedule helpers
// ---------------------------------------------------------------------

function euriborAt(revision: RevisionVariable, revisionIndex: number): number {
  return revision.euriborProyectado ? revision.euriborProyectado(revisionIndex) : revision.euriborActual;
}

/** Monthly (periodic) rate in effect for payment number `mes` (1-indexed). */
function rateForMonth(mes: number, tasa: TasaConfig): number {
  if (tasa.tipo === "fijo") return periodicRate(tasa.tipoAnual, 12);

  if (tasa.tipo === "variable") {
    const idx = Math.floor((mes - 1) / tasa.frecuenciaRevisionMeses);
    return periodicRate(euriborAt(tasa, idx) + tasa.diferencial, 12);
  }

  // mixto
  const finFijoMes = tasa.aniosFijo * 12;
  if (mes <= finFijoMes) return periodicRate(tasa.tipoFijoAnual, 12);
  const mesEnVariable = mes - finFijoMes;
  const idx = Math.floor((mesEnVariable - 1) / tasa.variable.frecuenciaRevisionMeses);
  return periodicRate(euriborAt(tasa.variable, idx) + tasa.variable.diferencial, 12);
}

/** Whether payment number `mes` is a structural revision point (rate recomputed even if the numeric value happens to repeat). */
function isRevisionMonth(mes: number, tasa: TasaConfig): boolean {
  if (mes === 1) return true;
  if (tasa.tipo === "fijo") return false;

  if (tasa.tipo === "variable") {
    return (mes - 1) % tasa.frecuenciaRevisionMeses === 0;
  }

  // mixto
  const finFijoMes = tasa.aniosFijo * 12;
  if (mes <= finFijoMes) return false;
  const mesEnVariable = mes - finFijoMes;
  return mesEnVariable === 1 || (mesEnVariable - 1) % tasa.variable.frecuenciaRevisionMeses === 0;
}

// ---------------------------------------------------------------------
// Amortización anticipada helper
// ---------------------------------------------------------------------

function extraForMonth(
  mes: number,
  saldo: number,
  anticipaciones: AmortizacionAnticipada[],
): { total: number; forzarRecalculo: boolean; acortaPlazo: boolean } {
  let total = 0;
  let forzarRecalculo = false;
  let acortaPlazo = false;

  for (const a of anticipaciones) {
    const aplica =
      a.tipo === "unica" ? a.mes === mes : mes >= a.mes && (mes - a.mes) % a.frecuenciaMeses === 0;
    if (!aplica) continue;
    total += a.importe;
    if (a.modo === "reducirCuota") forzarRecalculo = true;
    else acortaPlazo = true;
  }

  return { total: Math.min(total, Math.max(saldo, 0)), forzarRecalculo, acortaPlazo };
}

// ---------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------

function addMonths(start: Date, months: number): Date {
  const d = new Date(start.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------

const HARD_CAP_MESES = 1200; // 100 years — guards against a misconfigured loan that never amortizes

export function generateSchedule(input: ScheduleInput): ScheduleResult {
  const { capital, plazoMeses, fechaInicio, tasa, carencia, amortizacionesAnticipadas = [] } = input;

  if (!Number.isFinite(capital) || capital <= 0) {
    return { ok: false, error: "El capital debe ser un número positivo" };
  }
  if (!Number.isFinite(plazoMeses) || plazoMeses <= 0) {
    return { ok: false, error: "El plazo debe ser mayor que 0 meses" };
  }
  if (carencia && (carencia.meses < 0 || carencia.meses >= plazoMeses)) {
    return { ok: false, error: "La carencia debe ser menor que el plazo total del préstamo" };
  }

  const filas: ScheduleRow[] = [];
  let saldo = capital;
  let cuotaActual = 0;
  let forzarRecalculoSiguiente = false;
  let mesCruce: number | null = null;
  // The horizon revisions recompute towards. Starts at the contracted
  // term and only ever shortens, when a reducirPlazo amortización
  // anticipada happens — otherwise a later periodic revision would
  // recompute the cuota back down to fit the ORIGINAL maturity date,
  // silently undoing the term reduction and turning it into a de facto
  // reducirCuota. See schedule.test.ts's variable-rate reducirPlazo case.
  let plazoMesesEfectivo = plazoMeses;

  const carenciaMeses = carencia?.meses ?? 0;

  try {
    for (let mes = 1; mes <= HARD_CAP_MESES; mes++) {
      const rateMensual = rateForMonth(mes, tasa);
      const esCarencia = mes <= carenciaMeses;
      const esRevision = isRevisionMonth(mes, tasa);

      let interes: number;
      let principal: number;
      let cuota: number;

      if (esCarencia) {
        interes = saldo * rateMensual;
        if (carencia!.tipo === "parcial") {
          cuota = interes;
          principal = 0;
        } else {
          // Carencia total: nothing is paid, interest capitalizes onto the balance.
          cuota = 0;
          principal = -interes;
        }
        cuotaActual = 0; // force a fresh PMT once carencia ends
        forzarRecalculoSiguiente = true;
      } else {
        if (esRevision || forzarRecalculoSiguiente || cuotaActual === 0) {
          const mesesRestantes = plazoMesesEfectivo - mes + 1;
          if (mesesRestantes <= 0) {
            return { ok: false, error: "El plazo restante se agotó antes de terminar de amortizar" };
          }
          cuotaActual = pmt(rateMensual, mesesRestantes, saldo);
          forzarRecalculoSiguiente = false;
        }
        interes = saldo * rateMensual;
        cuota = cuotaActual;
        principal = cuota - interes;
      }

      let saldoFinal = saldo - principal;

      const { total: extra, forzarRecalculo, acortaPlazo } = esCarencia
        ? { total: 0, forzarRecalculo: false, acortaPlazo: false }
        : extraForMonth(mes, saldoFinal, amortizacionesAnticipadas);
      if (extra > 0) {
        saldoFinal -= extra;
        if (forzarRecalculo) forzarRecalculoSiguiente = true;
        if (acortaPlazo && saldoFinal > 0) {
          // Re-derive the horizon from here: how many months would it now
          // take to pay off the reduced balance at the current cuota/rate.
          try {
            plazoMesesEfectivo = Math.min(plazoMesesEfectivo, mes + nper(rateMensual, cuotaActual, saldoFinal));
          } catch {
            // cuotaActual no longer covers interest on the (now tiny) balance
            // at this rate — leave plazoMesesEfectivo as-is, the loan is
            // about to close out on its own from the shrunk balance anyway.
          }
        }
      }
      if (saldoFinal < 0.005) saldoFinal = 0;

      if (mesCruce === null && !esCarencia && principal > interes) {
        mesCruce = mes;
      }

      filas.push({
        n: mes,
        fecha: toIsoDate(addMonths(fechaInicio, mes)),
        saldoInicial: saldo,
        tipoAnualVigente: rateMensual * 12,
        cuota,
        interes,
        principal,
        extra,
        saldoFinal,
        esRevision,
        esCarencia,
      });

      saldo = saldoFinal;
      if (saldo <= 0) break;

      if (mes === HARD_CAP_MESES) {
        return {
          ok: false,
          error: "El préstamo no se amortiza dentro de 100 años: revisa la cuota, el tipo o la carencia",
        };
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }

  const interesesTotal = filas.reduce((sum, row) => sum + row.interes, 0);
  const costeTotal = filas.reduce((sum, row) => sum + row.cuota + row.extra, 0);

  return {
    ok: true,
    filas,
    mesesReales: filas.length,
    costeTotal,
    interesesTotal,
    mesCruce,
    fechaFin: filas[filas.length - 1].fecha,
  };
}
