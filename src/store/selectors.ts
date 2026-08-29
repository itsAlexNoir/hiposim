/**
 * Derived data. Every hook here is a pure composition of the raw input
 * state (useAppStore) through the engine (src/core) — nothing derived is
 * ever stored, so there is no way for a chart to disagree with a table.
 *
 * Each hook subscribes to individual state slices (not a combined object
 * literal) so components only re-render when something they actually use
 * changes.
 */
import { useMemo } from "react";
import { solveLoan, type SolveInput, type SolveResult, type SolveSuccess } from "@/core/solve";
import { generateSchedule, type ScheduleResult, type TasaConfig } from "@/core/schedule";
import { calcularTae, type TaeResult } from "@/core/tae";
import {
  DEFAULT_OTROS_COSTES,
  calcularCostesCompra,
  type CondicionesComprador,
  type ResumenCompra,
} from "@/core/spain/costs";
import {
  calcularCuotaMaximaPorDti,
  comisionMaximaAmortizacionAnticipada,
  evaluarAsequibilidad,
  type VeredictoAsequibilidad,
} from "@/core/spain/limits";
import {
  DEFAULT_COSTES_RECURRENTES,
  calcularCosteTotalPropiedad,
  calcularPrecioM2,
  compararConBarrio,
  type BenchmarkBarrio,
  type TcoResultado,
} from "@/core/property";
import { compararAlquilarComprar, type RentBuyResultado } from "@/core/rentbuy";
import { getBarrioById } from "@/data/salamanca";
import { useAppStore } from "./useAppStore";
import type { HipotecaConfig, ViviendaCandidata } from "./types";

// ---------------------------------------------------------------------
// Vivienda activa
// ---------------------------------------------------------------------

export function useViviendaActiva(): ViviendaCandidata | null {
  const viviendas = useAppStore((s) => s.viviendas);
  const id = useAppStore((s) => s.viviendaSeleccionadaId);
  return useMemo(() => viviendas.find((v) => v.id === id) ?? null, [viviendas, id]);
}

export function benchmarkVivienda(v: ViviendaCandidata): BenchmarkBarrio {
  // calcularPrecioM2 throws for metrosConstruidos <= 0 (by design — see its
  // doc comment). This runs during render (useMemo below), so a stale or
  // just-typed invalid value must never reach it: fall back to NaN, which
  // the existing formatEurPerM2/formatPct helpers already render as "—".
  const precioM2 = v.metrosConstruidos > 0 ? calcularPrecioM2(v.precio, v.metrosConstruidos) : NaN;
  const barrio = v.barrioId ? getBarrioById(v.barrioId) : undefined;
  return compararConBarrio(precioM2, barrio?.precioVentaM2 ?? null);
}

export function useViviendasConBenchmark(): { vivienda: ViviendaCandidata; benchmark: BenchmarkBarrio }[] {
  const viviendas = useAppStore((s) => s.viviendas);
  return useMemo(() => viviendas.map((vivienda) => ({ vivienda, benchmark: benchmarkVivienda(vivienda) })), [
    viviendas,
  ]);
}

// ---------------------------------------------------------------------
// Hipoteca: composing HipotecaConfig into solve.ts / schedule.ts inputs
// ---------------------------------------------------------------------

/** The day-1 nominal annual rate the solver operates on, given the current tipoHipoteca mode. */
export function tipoAnualEfectivo(c: HipotecaConfig): number {
  if (c.tipoHipoteca === "fijo") return c.tipoAnualFijoInput;
  if (c.tipoHipoteca === "variable") return c.euriborActual + c.diferencial;
  return c.tipoFijoAnualMixto;
}

function composeSolveInput(c: HipotecaConfig): SolveInput {
  return {
    solveFor: c.solveFor,
    capital: c.solveFor === "capital" ? undefined : c.capitalInput,
    cuota: c.solveFor === "cuota" ? undefined : c.cuotaInput,
    plazoAnios: c.solveFor === "plazo" ? undefined : c.plazoAniosInput,
    tipoAnual: c.solveFor === "tipo" ? undefined : tipoAnualEfectivo(c),
  };
}

/** Builds the richer schedule.ts rate config, reconciling it with whatever solve.ts just solved. */
function composeTasaConfig(c: HipotecaConfig, solved: SolveSuccess): TasaConfig {
  if (c.tipoHipoteca === "fijo") {
    return { tipo: "fijo", tipoAnual: c.solveFor === "tipo" ? solved.tipoAnual : c.tipoAnualFijoInput };
  }
  if (c.tipoHipoteca === "variable") {
    const diferencial = c.solveFor === "tipo" ? solved.tipoAnual - c.euriborActual : c.diferencial;
    return {
      tipo: "variable",
      diferencial,
      euriborActual: c.euriborActual,
      frecuenciaRevisionMeses: c.frecuenciaRevisionMeses,
    };
  }
  const tipoFijoAnual = c.solveFor === "tipo" ? solved.tipoAnual : c.tipoFijoAnualMixto;
  return {
    tipo: "mixto",
    aniosFijo: c.aniosFijo,
    tipoFijoAnual,
    variable: {
      diferencial: c.diferencial,
      euriborActual: c.euriborActual,
      frecuenciaRevisionMeses: c.frecuenciaRevisionMeses,
    },
  };
}

export function useSolveResult(): SolveResult {
  const hipoteca = useAppStore((s) => s.hipoteca);
  return useMemo(() => solveLoan(composeSolveInput(hipoteca)), [hipoteca]);
}

const FECHA_INICIO_APP = new Date();

export function useSchedule(): ScheduleResult | null {
  const hipoteca = useAppStore((s) => s.hipoteca);
  const solveResult = useSolveResult();

  return useMemo(() => {
    if (!solveResult.ok) return null;
    const tasa = composeTasaConfig(hipoteca, solveResult);
    return generateSchedule({
      capital: solveResult.capital,
      plazoMeses: solveResult.plazoMeses,
      fechaInicio: FECHA_INICIO_APP,
      tasa,
      carencia: hipoteca.carenciaMeses > 0 ? { meses: hipoteca.carenciaMeses, tipo: hipoteca.carenciaTipo } : undefined,
      amortizacionesAnticipadas: hipoteca.amortizacionesAnticipadas,
    });
  }, [hipoteca, solveResult]);
}

/** Same schedule but ignoring amortizacionesAnticipadas — the baseline the early-repayment simulator compares against. */
export function useScheduleSinAnticipada(): ScheduleResult | null {
  const hipoteca = useAppStore((s) => s.hipoteca);
  const solveResult = useSolveResult();

  return useMemo(() => {
    if (!solveResult.ok) return null;
    const tasa = composeTasaConfig(hipoteca, solveResult);
    return generateSchedule({
      capital: solveResult.capital,
      plazoMeses: solveResult.plazoMeses,
      fechaInicio: FECHA_INICIO_APP,
      tasa,
      carencia: hipoteca.carenciaMeses > 0 ? { meses: hipoteca.carenciaMeses, tipo: hipoteca.carenciaTipo } : undefined,
    });
  }, [hipoteca, solveResult]);
}

/** Which legal penalty regime applies to an amortización anticipada made in a given month, for a mixto loan. */
export function tipoParaPenalizacion(c: HipotecaConfig, mes: number): "fijo" | "variable" {
  if (c.tipoHipoteca === "fijo") return "fijo";
  if (c.tipoHipoteca === "variable") return "variable";
  return mes <= c.aniosFijo * 12 ? "fijo" : "variable";
}

export function useTae(): TaeResult | null {
  const hipoteca = useAppStore((s) => s.hipoteca);
  const otrosCostes = useAppStore((s) => s.otrosCostes);
  const solveResult = useSolveResult();
  const schedule = useSchedule();

  return useMemo(() => {
    if (!solveResult.ok || !schedule || !schedule.ok) return null;
    const tasacion = otrosCostes.tasacion ?? DEFAULT_OTROS_COSTES.tasacion;
    return calcularTae({
      capitalRecibido: solveResult.capital,
      comisionApertura: solveResult.capital * hipoteca.comisionAperturaPct,
      tasacion,
      cuotas: schedule.filas.map((f) => f.cuota + f.extra),
      bonificaciones: hipoteca.bonificaciones,
    });
  }, [solveResult, schedule, hipoteca.comisionAperturaPct, hipoteca.bonificaciones, otrosCostes.tasacion]);
}

// ---------------------------------------------------------------------
// Compra: purchase-cost breakdown for the vivienda activa
// ---------------------------------------------------------------------

export function useResumenCompra(): ResumenCompra | null {
  const vivienda = useViviendaActiva();
  const condicionesComprador = useAppStore((s) => s.condicionesComprador);
  const otrosCostes = useAppStore((s) => s.otrosCostes);

  return useMemo(() => {
    if (!vivienda) return null;
    // municipioRural is a property of the house, not the buyer — the
    // global buyer profile's own municipioRural flag is ignored here.
    const condiciones: CondicionesComprador = { ...condicionesComprador, municipioRural: vivienda.municipioRural };
    return calcularCostesCompra(
      vivienda.tipoVivienda,
      { precio: vivienda.precio, valorReferencia: vivienda.valorReferencia },
      condiciones,
      otrosCostes,
    );
  }, [vivienda, condicionesComprador, otrosCostes]);
}

// ---------------------------------------------------------------------
// Asequibilidad: LTV + DTI verdict for the vivienda activa
// ---------------------------------------------------------------------

export function useAsequibilidad(): VeredictoAsequibilidad | null {
  const vivienda = useViviendaActiva();
  const resumenCompra = useResumenCompra();
  const perfilFinanciero = useAppStore((s) => s.perfilFinanciero);
  const solveResult = useSolveResult();

  return useMemo(() => {
    if (!vivienda || !resumenCompra || !solveResult.ok) return null;
    return evaluarAsequibilidad({
      precio: vivienda.precio,
      costesCompra: resumenCompra.totalImpuestos + resumenCompra.totalOtrosCostes,
      capitalPrestamo: solveResult.capital,
      cuotaPropuesta: solveResult.cuota,
      ingresosNetosMensuales: perfilFinanciero.ingresosNetosMensuales,
      deudaExistenteMensual: perfilFinanciero.deudaExistenteMensual,
      ltvMaximoPct: perfilFinanciero.ltvMaximoPct,
      dtiMaximoPct: perfilFinanciero.dtiMaximoPct,
    });
  }, [vivienda, resumenCompra, solveResult, perfilFinanciero]);
}

export { calcularCuotaMaximaPorDti, comisionMaximaAmortizacionAnticipada };

// ---------------------------------------------------------------------
// Coste total de propiedad (TCO) sobre un horizonte de N años
// ---------------------------------------------------------------------

export function useCosteTotalPropiedad(anios: number): TcoResultado | null {
  const vivienda = useViviendaActiva();
  const resumenCompra = useResumenCompra();
  const solveResult = useSolveResult();
  const schedule = useSchedule();
  const escenarios = useAppStore((s) => s.escenarios);

  return useMemo(() => {
    if (!vivienda || !resumenCompra || !solveResult.ok || !schedule || !schedule.ok) return null;
    const meses = Math.min(Math.round(anios * 12), schedule.filas.length);
    if (meses <= 0) return null;
    const filasHorizonte = schedule.filas.slice(0, meses);
    const interesesPagados = filasHorizonte.reduce((s, f) => s + f.interes, 0);
    const saldoPendiente = filasHorizonte.at(-1)?.saldoFinal ?? 0;
    const entradaAportada = Math.max(vivienda.precio - solveResult.capital, 0);
    const valorViviendaEstimado =
      vivienda.precio * Math.pow(1 + escenarios.crecimientoValorViviendaAnual, anios);

    return calcularCosteTotalPropiedad({
      entradaAportada,
      costesCompra: resumenCompra.totalImpuestos + resumenCompra.totalOtrosCostes,
      interesesPagados,
      costesRecurrentesAnuales: DEFAULT_COSTES_RECURRENTES,
      anios,
      valorViviendaEstimado,
      saldoPendiente,
    });
  }, [vivienda, resumenCompra, solveResult, schedule, anios, escenarios.crecimientoValorViviendaAnual]);
}

// ---------------------------------------------------------------------
// Alquilar vs comprar
// ---------------------------------------------------------------------

export function useRentBuy(): RentBuyResultado | null {
  const vivienda = useViviendaActiva();
  const resumenCompra = useResumenCompra();
  const solveResult = useSolveResult();
  const schedule = useSchedule();
  const escenarios = useAppStore((s) => s.escenarios);

  return useMemo(() => {
    if (!vivienda || !resumenCompra || !solveResult.ok || !schedule || !schedule.ok) return null;
    const meses = Math.min(Math.round(escenarios.aniosRentBuy * 12), schedule.filas.length);
    if (meses <= 0) return null;
    const saldoPendienteFinal = schedule.filas[meses - 1]?.saldoFinal ?? 0;
    const valorViviendaEstimadoFinal =
      vivienda.precio * Math.pow(1 + escenarios.crecimientoValorViviendaAnual, escenarios.aniosRentBuy);
    const entradaAportada = Math.max(vivienda.precio - solveResult.capital, 0);

    const result = compararAlquilarComprar({
      anios: escenarios.aniosRentBuy,
      entradaAportada,
      costesCompra: resumenCompra.totalImpuestos + resumenCompra.totalOtrosCostes,
      cuotaHipotecaMensual: solveResult.cuota,
      costesRecurrentesAnuales: DEFAULT_COSTES_RECURRENTES,
      valorViviendaEstimadoFinal,
      saldoPendienteFinal,
      alquilerMensualInicial: escenarios.alquilerMensualInicial,
      crecimientoAlquilerAnual: escenarios.crecimientoAlquilerAnual,
      rentabilidadInversionAnual: escenarios.rentabilidadInversionAnual,
    });
    return result.ok ? result : null;
  }, [vivienda, resumenCompra, solveResult, schedule, escenarios]);
}
