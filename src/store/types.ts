/**
 * Shared domain types for the app's input state. These describe *inputs*
 * only — every derived number (schedules, costs, TAE, affordability) is
 * computed on demand by selectors.ts, never stored, so there is nothing
 * here that can drift out of sync with what the user typed.
 */
import type { AmortizacionAnticipada } from "@/core/schedule";
import type { Bonificacion } from "@/core/tae";
import type { CondicionesComprador, TipoVivienda } from "@/core/spain/costs";
import type { SolveFor } from "@/core/solve";

export type { AmortizacionAnticipada, Bonificacion, CondicionesComprador, TipoVivienda, SolveFor };

export interface ViviendaCandidata {
  id: string;
  nombre: string;
  precio: number;
  metrosUtiles: number;
  /** Superficie construida — la base sobre la que se calcula el €/m² (convención habitual del mercado inmobiliario). */
  metrosConstruidos: number;
  /** Links to a src/data/salamanca.ts barrio, or null for a house outside the seeded list. */
  barrioId: string | null;
  valorReferencia?: number;
  tipoVivienda: TipoVivienda;
  /** <10.000 habitantes (o <3.000 a menos de 30km de la capital) — habilita el tipo joven-rural del ITP/AJD. */
  municipioRural: boolean;
}

export type TipoHipoteca = "fijo" | "variable" | "mixto";

export interface HipotecaConfig {
  solveFor: SolveFor;
  capitalInput: number;
  cuotaInput: number;
  plazoAniosInput: number;
  /** Day-1 nominal annual rate when tipoHipoteca === "fijo". */
  tipoAnualFijoInput: number;

  tipoHipoteca: TipoHipoteca;
  /** Differential over Euríbor, for variable/mixto. */
  diferencial: number;
  euriborActual: number;
  frecuenciaRevisionMeses: 6 | 12;
  /** Years at the fixed rate before switching to variable, for mixto. */
  aniosFijo: number;
  /** The fixed segment's rate, for mixto. */
  tipoFijoAnualMixto: number;

  carenciaMeses: number;
  carenciaTipo: "parcial" | "total";

  amortizacionesAnticipadas: AmortizacionAnticipada[];
  comisionAperturaPct: number;
  bonificaciones: Bonificacion[];
}

export interface OtrosCostesOverrides {
  notariaPct?: number;
  registroPct?: number;
  gestoria?: number;
  tasacion?: number;
}

export interface PerfilFinanciero {
  ingresosNetosMensuales: number;
  deudaExistenteMensual: number;
  ltvMaximoPct: number;
  dtiMaximoPct: number;
}

export interface EscenariosConfig {
  aniosRentBuy: number;
  alquilerMensualInicial: number;
  crecimientoAlquilerAnual: number;
  rentabilidadInversionAnual: number;
  crecimientoValorViviendaAnual: number;
  /** How much can realistically be saved each month towards the entrada — feeds the savings-runway calculation. */
  ahorroMensualDisponible: number;
}

export type TabId = "inicio" | "panel" | "viviendas" | "compra" | "hipoteca" | "escenarios";
