import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  CONDICIONES_COMPRADOR_INICIAL,
  ESCENARIOS_INICIAL,
  HIPOTECA_INICIAL,
  OTROS_COSTES_INICIAL,
  PERFIL_FINANCIERO_INICIAL,
  VIVIENDAS_INICIALES,
  VIVIENDA_SELECCIONADA_INICIAL,
} from "./defaults";
import { persistStorage } from "./persistStorage";
import type {
  CondicionesComprador,
  EscenariosConfig,
  HipotecaConfig,
  OtrosCostesOverrides,
  PerfilFinanciero,
  TabId,
  ViviendaCandidata,
} from "./types";

/** Smallest unused `vivienda-N` id, derived from current state — safe across page reloads once state is persisted. */
function nextViviendaId(viviendas: ViviendaCandidata[]): string {
  const maxN = viviendas.reduce((max, v) => {
    const m = /^vivienda-(\d+)$/.exec(v.id);
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);
  return `vivienda-${maxN + 1}`;
}

export interface AppState {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;

  condicionesComprador: CondicionesComprador;
  setCondicionesComprador: (patch: Partial<CondicionesComprador>) => void;

  viviendas: ViviendaCandidata[];
  viviendaSeleccionadaId: string | null;
  addVivienda: (v: Omit<ViviendaCandidata, "id">) => void;
  updateVivienda: (id: string, patch: Partial<ViviendaCandidata>) => void;
  removeVivienda: (id: string) => void;
  selectVivienda: (id: string | null) => void;

  hipoteca: HipotecaConfig;
  setHipoteca: (patch: Partial<HipotecaConfig>) => void;

  otrosCostes: OtrosCostesOverrides;
  setOtrosCostes: (patch: Partial<OtrosCostesOverrides>) => void;

  perfilFinanciero: PerfilFinanciero;
  setPerfilFinanciero: (patch: Partial<PerfilFinanciero>) => void;

  escenarios: EscenariosConfig;
  setEscenarios: (patch: Partial<EscenariosConfig>) => void;
}

/** Fields persisted to disk (app-data dir under Tauri, localStorage in the browser) — excludes activeTab and every action. */
type PersistedState = Pick<
  AppState,
  | "condicionesComprador"
  | "viviendas"
  | "viviendaSeleccionadaId"
  | "hipoteca"
  | "otrosCostes"
  | "perfilFinanciero"
  | "escenarios"
>;

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeTab: "inicio",
      setActiveTab: (tab) => set({ activeTab: tab }),

      condicionesComprador: CONDICIONES_COMPRADOR_INICIAL,
      setCondicionesComprador: (patch) =>
        set((s) => ({ condicionesComprador: { ...s.condicionesComprador, ...patch } })),

      viviendas: VIVIENDAS_INICIALES,
      viviendaSeleccionadaId: VIVIENDA_SELECCIONADA_INICIAL,
      addVivienda: (v) =>
        set((s) => {
          const id = nextViviendaId(s.viviendas);
          return { viviendas: [...s.viviendas, { ...v, id }], viviendaSeleccionadaId: id };
        }),
      updateVivienda: (id, patch) =>
        set((s) => ({ viviendas: s.viviendas.map((v) => (v.id === id ? { ...v, ...patch } : v)) })),
      removeVivienda: (id) =>
        set((s) => {
          const viviendas = s.viviendas.filter((v) => v.id !== id);
          const viviendaSeleccionadaId =
            s.viviendaSeleccionadaId === id ? (viviendas[0]?.id ?? null) : s.viviendaSeleccionadaId;
          return { viviendas, viviendaSeleccionadaId };
        }),
      selectVivienda: (id) => set({ viviendaSeleccionadaId: id }),

      hipoteca: HIPOTECA_INICIAL,
      setHipoteca: (patch) => set((s) => ({ hipoteca: { ...s.hipoteca, ...patch } })),

      otrosCostes: OTROS_COSTES_INICIAL,
      setOtrosCostes: (patch) => set((s) => ({ otrosCostes: { ...s.otrosCostes, ...patch } })),

      perfilFinanciero: PERFIL_FINANCIERO_INICIAL,
      setPerfilFinanciero: (patch) => set((s) => ({ perfilFinanciero: { ...s.perfilFinanciero, ...patch } })),

      escenarios: ESCENARIOS_INICIAL,
      setEscenarios: (patch) => set((s) => ({ escenarios: { ...s.escenarios, ...patch } })),
    }),
    {
      name: "hiposim-state",
      version: 2,
      storage: createJSONStorage(() => persistStorage),
      // v1 -> v2: ViviendaCandidata.metrosCuadrados split into metrosUtiles +
      // metrosConstruidos. Old data only had one figure — treat it as the
      // construidos value (what €/m² was always computed against) and
      // estimate útiles at the typical ~85% coefficient.
      migrate: (persisted, version) => {
        const p = persisted as { viviendas?: Array<Record<string, unknown>> } | null;
        if (version >= 2 || !p?.viviendas) return persisted as PersistedState;
        return {
          ...p,
          viviendas: p.viviendas.map((v) => {
            if (typeof v.metrosConstruidos === "number") return v;
            const metrosConstruidos = typeof v.metrosCuadrados === "number" ? v.metrosCuadrados : 0;
            const { metrosCuadrados: _drop, ...rest } = v;
            return { ...rest, metrosConstruidos, metrosUtiles: Math.round(metrosConstruidos * 0.85) };
          }),
        } as unknown as PersistedState;
      },
      partialize: (s): PersistedState => ({
        condicionesComprador: s.condicionesComprador,
        viviendas: s.viviendas,
        viviendaSeleccionadaId: s.viviendaSeleccionadaId,
        hipoteca: s.hipoteca,
        otrosCostes: s.otrosCostes,
        perfilFinanciero: s.perfilFinanciero,
        escenarios: s.escenarios,
      }),
      // Deep-merge each config slice against its defaults rather than a
      // shallow top-level replace, so a persisted blob from an older
      // version missing a newly-added field still gets a sane default
      // for that field instead of `undefined`.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<PersistedState>;
        return {
          ...current,
          ...p,
          condicionesComprador: { ...current.condicionesComprador, ...p.condicionesComprador },
          hipoteca: { ...current.hipoteca, ...p.hipoteca },
          otrosCostes: { ...current.otrosCostes, ...p.otrosCostes },
          perfilFinanciero: { ...current.perfilFinanciero, ...p.perfilFinanciero },
          escenarios: { ...current.escenarios, ...p.escenarios },
        };
      },
    },
  ),
);
