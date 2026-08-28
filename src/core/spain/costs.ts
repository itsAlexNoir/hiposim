/**
 * Purchase taxes and costs for housing in Castilla y León.
 *
 * Rates verified against the Junta de Castilla y León's own published
 * tables (tributos.jcyl.es) as of August 2026 — see RATES_AS_OF. This is
 * a simulator, not tax advice: the reduced AJD rates (0.5% / 0.01%) carry
 * income limits whose exact thresholds should be re-checked against the
 * Junta's site, since they are not encoded here.
 *
 * Deliberately excludes anything to do with the *mortgage* deed — since
 * Ley 5/2019 (Ley de Contratos de Crédito Inmobiliario), the AJD on the
 * mortgage, and the notaría/registro/gestoría for the mortgage deed, are
 * all paid by the bank, never the buyer. Only the tasación and, if the
 * bank charges one, the comisión de apertura fall on the buyer — and
 * those are loan-side costs (see tae.ts), not purchase-side ones. What
 * this module computes is exclusively the cost of the *compraventa*
 * (property transfer) itself.
 */

export const RATES_AS_OF = "2026-08-28";

export type TipoVivienda = "segundaMano" | "obraNueva";

export interface CondicionesComprador {
  menorDe36: boolean;
  primeraViviendaHabitual: boolean;
  familiaNumerosa: boolean;
  /** Grado de discapacidad ≥ 65%, del comprador o un familiar. */
  discapacidad: boolean;
  /** Vivienda de protección oficial / pública. */
  vpo: boolean;
  /** Municipio de <10.000 habitantes (o <3.000 si está a menos de 30km de la capital de provincia). */
  municipioRural: boolean;
  /**
   * Whether the buyer is within the income limits the Junta attaches to
   * the AJD 0,5%/0,01% reduced rates. Defaults to true (assume eligible)
   * since exact thresholds are not modelled here — surface a caveat in
   * the UI rather than silently denying the reduction.
   */
  dentroLimiteRenta: boolean;
}

export const CONDICIONES_COMPRADOR_DEFECTO: CondicionesComprador = {
  menorDe36: false,
  primeraViviendaHabitual: true,
  familiaNumerosa: false,
  discapacidad: false,
  vpo: false,
  municipioRural: false,
  dentroLimiteRenta: true,
};

export interface PrecioVivienda {
  /** Precio escriturado. */
  precio: number;
  /** Valor de referencia catastral, si se conoce — la base imponible del ITP es el mayor de los dos. */
  valorReferencia?: number;
}

function baseImponible(precio: PrecioVivienda): number {
  return Math.max(precio.precio, precio.valorReferencia ?? 0);
}

// ---------------------------------------------------------------------
// ITP — segunda mano
// ---------------------------------------------------------------------

const ITP_TRAMO1_LIMITE = 250_000;
const ITP_TIPO_TRAMO1 = 0.08;
const ITP_TIPO_TRAMO2 = 0.1;
const ITP_TIPO_REDUCIDO = 0.04;
const ITP_TIPO_RURAL_JOVEN = 0.0001;
const ITP_RURAL_JOVEN_LIMITE_VALOR = 150_000;

export interface ImpuestoResultado {
  base: number;
  tipoAplicado: number;
  cuota: number;
  motivo: string;
}

/** ITP for a segunda mano (resale) purchase. */
export function calcularItp(
  precio: PrecioVivienda,
  condiciones: CondicionesComprador = CONDICIONES_COMPRADOR_DEFECTO,
): ImpuestoResultado {
  const base = baseImponible(precio);

  const elegibleRuralJoven =
    condiciones.menorDe36 &&
    condiciones.primeraViviendaHabitual &&
    condiciones.municipioRural &&
    base < ITP_RURAL_JOVEN_LIMITE_VALOR;
  if (elegibleRuralJoven) {
    return {
      base,
      tipoAplicado: ITP_TIPO_RURAL_JOVEN,
      cuota: base * ITP_TIPO_RURAL_JOVEN,
      motivo: "Joven <36 años, primera vivienda habitual en municipio rural, valor <150.000€ (0,01%)",
    };
  }

  const elegibleReducido =
    condiciones.primeraViviendaHabitual &&
    (condiciones.menorDe36 || condiciones.familiaNumerosa || condiciones.discapacidad || condiciones.vpo);
  if (elegibleReducido) {
    return {
      base,
      tipoAplicado: ITP_TIPO_REDUCIDO,
      cuota: base * ITP_TIPO_REDUCIDO,
      motivo: "Tipo reducido de apoyo a la vivienda (4%)",
    };
  }

  if (base <= ITP_TRAMO1_LIMITE) {
    return { base, tipoAplicado: ITP_TIPO_TRAMO1, cuota: base * ITP_TIPO_TRAMO1, motivo: "Tipo general (8%)" };
  }
  const cuota = ITP_TRAMO1_LIMITE * ITP_TIPO_TRAMO1 + (base - ITP_TRAMO1_LIMITE) * ITP_TIPO_TRAMO2;
  return {
    base,
    tipoAplicado: cuota / base, // blended, informational only — the tax itself is computed by bracket
    cuota,
    motivo: "Escala general: 8% hasta 250.000€ + 10% sobre el exceso",
  };
}

// ---------------------------------------------------------------------
// IVA + AJD — obra nueva
// ---------------------------------------------------------------------

const IVA_TIPO_GENERAL = 0.1;
const IVA_TIPO_VPO = 0.04;
const AJD_TIPO_GENERAL = 0.015;
const AJD_TIPO_REDUCIDO = 0.005;
const AJD_TIPO_RURAL_JOVEN = 0.0001;

export interface ObraNuevaResultado {
  base: number;
  iva: ImpuestoResultado;
  ajd: ImpuestoResultado;
}

/** IVA + AJD for an obra nueva (new-build, primera transmisión) purchase. */
export function calcularObraNueva(
  precio: PrecioVivienda,
  condiciones: CondicionesComprador = CONDICIONES_COMPRADOR_DEFECTO,
): ObraNuevaResultado {
  const base = baseImponible(precio);

  const tipoIva = condiciones.vpo ? IVA_TIPO_VPO : IVA_TIPO_GENERAL;
  const iva: ImpuestoResultado = {
    base,
    tipoAplicado: tipoIva,
    cuota: base * tipoIva,
    motivo: condiciones.vpo ? "IVA reducido VPO régimen especial (4%)" : "IVA general vivienda nueva (10%)",
  };

  const elegibleRuralJoven =
    condiciones.dentroLimiteRenta &&
    condiciones.menorDe36 &&
    condiciones.primeraViviendaHabitual &&
    condiciones.municipioRural &&
    base < ITP_RURAL_JOVEN_LIMITE_VALOR;
  if (elegibleRuralJoven) {
    return {
      base,
      iva,
      ajd: {
        base,
        tipoAplicado: AJD_TIPO_RURAL_JOVEN,
        cuota: base * AJD_TIPO_RURAL_JOVEN,
        motivo: "AJD reducido: joven rural, primera vivienda, valor <150.000€ (0,01%)",
      },
    };
  }

  const elegibleReducido =
    condiciones.dentroLimiteRenta &&
    condiciones.primeraViviendaHabitual &&
    (condiciones.menorDe36 || condiciones.familiaNumerosa || condiciones.discapacidad || condiciones.vpo);
  if (elegibleReducido) {
    return {
      base,
      iva,
      ajd: {
        base,
        tipoAplicado: AJD_TIPO_REDUCIDO,
        cuota: base * AJD_TIPO_REDUCIDO,
        motivo: "AJD reducido de apoyo a la vivienda (0,5%)",
      },
    };
  }

  return {
    base,
    iva,
    ajd: { base, tipoAplicado: AJD_TIPO_GENERAL, cuota: base * AJD_TIPO_GENERAL, motivo: "AJD general (1,5%)" },
  };
}

// ---------------------------------------------------------------------
// Otros costes de la compraventa (a cargo del comprador)
// ---------------------------------------------------------------------

export interface OtrosCostesInput {
  precio: number;
  notariaPct?: number;
  registroPct?: number;
  gestoria?: number;
  tasacion?: number;
}

export const DEFAULT_OTROS_COSTES = {
  notariaPct: 0.0035,
  registroPct: 0.00175,
  gestoria: 300,
  tasacion: 325,
};

/** [min, max] bounds for the percentage/€ sliders in the UI. */
export const RANGOS_OTROS_COSTES = {
  notariaPct: [0.002, 0.005] as const,
  registroPct: [0.001, 0.0025] as const,
  tasacion: [250, 400] as const,
};

export interface DesgloseOtrosCostes {
  notaria: number;
  registro: number;
  gestoria: number;
  tasacion: number;
  total: number;
}

export function calcularOtrosCostes(input: OtrosCostesInput): DesgloseOtrosCostes {
  const notariaPct = input.notariaPct ?? DEFAULT_OTROS_COSTES.notariaPct;
  const registroPct = input.registroPct ?? DEFAULT_OTROS_COSTES.registroPct;
  const gestoria = input.gestoria ?? DEFAULT_OTROS_COSTES.gestoria;
  const tasacion = input.tasacion ?? DEFAULT_OTROS_COSTES.tasacion;

  const notaria = input.precio * notariaPct;
  const registro = input.precio * registroPct;

  return { notaria, registro, gestoria, tasacion, total: notaria + registro + gestoria + tasacion };
}

// ---------------------------------------------------------------------
// Resumen completo — listo para un waterfall chart
// ---------------------------------------------------------------------

export interface PartidaCoste {
  concepto: string;
  importe: number;
}

export interface ResumenCompra {
  tipoVivienda: TipoVivienda;
  precio: number;
  baseImponible: number;
  totalImpuestos: number;
  totalOtrosCostes: number;
  totalDesembolso: number;
  partidas: PartidaCoste[];
}

export function calcularCostesCompra(
  tipoVivienda: TipoVivienda,
  precioVivienda: PrecioVivienda,
  condiciones: CondicionesComprador = CONDICIONES_COMPRADOR_DEFECTO,
  otrosCostesInput: Omit<OtrosCostesInput, "precio"> = {},
): ResumenCompra {
  const otros = calcularOtrosCostes({ precio: precioVivienda.precio, ...otrosCostesInput });
  const partidas: PartidaCoste[] = [{ concepto: "Precio vivienda", importe: precioVivienda.precio }];
  let totalImpuestos: number;

  if (tipoVivienda === "segundaMano") {
    const itp = calcularItp(precioVivienda, condiciones);
    partidas.push({ concepto: `ITP (${itp.motivo})`, importe: itp.cuota });
    totalImpuestos = itp.cuota;
  } else {
    const { iva, ajd } = calcularObraNueva(precioVivienda, condiciones);
    partidas.push({ concepto: `IVA (${iva.motivo})`, importe: iva.cuota });
    partidas.push({ concepto: `AJD (${ajd.motivo})`, importe: ajd.cuota });
    totalImpuestos = iva.cuota + ajd.cuota;
  }

  partidas.push(
    { concepto: "Notaría (compraventa)", importe: otros.notaria },
    { concepto: "Registro de la Propiedad", importe: otros.registro },
    { concepto: "Gestoría", importe: otros.gestoria },
    { concepto: "Tasación", importe: otros.tasacion },
  );

  const totalOtrosCostes = otros.total;
  const totalDesembolso = precioVivienda.precio + totalImpuestos + totalOtrosCostes;

  return {
    tipoVivienda,
    precio: precioVivienda.precio,
    baseImponible: baseImponible(precioVivienda),
    totalImpuestos,
    totalOtrosCostes,
    totalDesembolso,
    partidas,
  };
}
