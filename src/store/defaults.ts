import { CONDICIONES_COMPRADOR_DEFECTO } from "@/core/spain/costs";
import type {
  CondicionesComprador,
  EscenariosConfig,
  HipotecaConfig,
  OtrosCostesOverrides,
  PerfilFinanciero,
  ViviendaCandidata,
} from "./types";

// Seed data so the dashboard opens with a realistic, populated example
// rather than a blank slate — three candidate flats across Salamanca
// barrios, used throughout the Viviendas comparator and Panel.
export const VIVIENDAS_INICIALES: ViviendaCandidata[] = [
  {
    id: "garrido-85",
    nombre: "Piso en Garrido",
    precio: 200_000,
    metrosCuadrados: 85,
    barrioId: "garrido",
    tipoVivienda: "segundaMano",
    municipioRural: false,
  },
  {
    id: "centro-70",
    nombre: "Ático en Centro",
    precio: 240_000,
    metrosCuadrados: 70,
    barrioId: "centro",
    tipoVivienda: "segundaMano",
    municipioRural: false,
  },
  {
    id: "pizarrales-95",
    nombre: "Piso en Pizarrales",
    precio: 175_000,
    metrosCuadrados: 95,
    barrioId: "pizarrales",
    tipoVivienda: "segundaMano",
    municipioRural: false,
  },
];

export const VIVIENDA_SELECCIONADA_INICIAL = "garrido-85";

export const HIPOTECA_INICIAL: HipotecaConfig = {
  solveFor: "cuota",
  capitalInput: 160_000,
  cuotaInput: 800,
  plazoAniosInput: 25,
  tipoAnualFijoInput: 0.032,

  tipoHipoteca: "fijo",
  diferencial: 0.006,
  euriborActual: 0.0295, // media de agosto de 2026
  frecuenciaRevisionMeses: 12,
  aniosFijo: 5,
  tipoFijoAnualMixto: 0.025,

  carenciaMeses: 0,
  carenciaTipo: "parcial",

  amortizacionesAnticipadas: [],
  comisionAperturaPct: 0,
  bonificaciones: [],
};

export const CONDICIONES_COMPRADOR_INICIAL: CondicionesComprador = { ...CONDICIONES_COMPRADOR_DEFECTO };

export const OTROS_COSTES_INICIAL: OtrosCostesOverrides = {};

export const PERFIL_FINANCIERO_INICIAL: PerfilFinanciero = {
  ingresosNetosMensuales: 2800,
  deudaExistenteMensual: 0,
  ltvMaximoPct: 0.8,
  dtiMaximoPct: 0.35,
};

export const ESCENARIOS_INICIAL: EscenariosConfig = {
  aniosRentBuy: 15,
  alquilerMensualInicial: 750,
  crecimientoAlquilerAnual: 0.02,
  rentabilidadInversionAnual: 0.04,
  crecimientoValorViviendaAnual: 0.02,
  ahorroMensualDisponible: 500,
};
