# Arquitectura

Cómo está organizado el código y por qué, para quien vaya a extender HipoSim.

- [Principio de diseño](#principio-de-diseño)
- [La capa de motor (`src/core/`)](#la-capa-de-motor-srccore)
- [El store y los selectores](#el-store-y-los-selectores)
- [Flujo de datos](#flujo-de-datos)
- [Persistencia](#persistencia)
- [Cómo se probó (y cómo probar lo nuevo)](#cómo-se-probó-y-cómo-probar-lo-nuevo)
- [Añadir una funcionalidad nueva](#añadir-una-funcionalidad-nueva)

## Principio de diseño

**Todo lo derivado se calcula, nunca se guarda.** El store de Zustand (`src/store/useAppStore.ts`) contiene únicamente los valores que el usuario introduce: el capital, la cuota, el tipo de interés, la lista de viviendas, el perfil financiero. La cuota resultante de un cálculo, el cuadro de amortización, la TAE, el veredicto de asequibilidad — nada de eso vive en el store. Se recalcula en cada render a partir de los inputs, vía funciones puras en `src/core/` compuestas por hooks en `src/store/selectors.ts`.

La consecuencia práctica: **es estructuralmente imposible que un gráfico y una tabla se desincronicen**, porque ambos llaman al mismo selector, que llama a la misma función del motor. No hay un `useEffect` que sincronice un cálculo derivado con el estado — si hiciera falta, sería una señal de que ese cálculo debería ser un selector, no estado.

La segunda propiedad importante: **el motor (`src/core/`) no importa nada de React, Zustand ni Tauri**. Es TypeScript puro, con funciones deterministas que reciben datos y devuelven datos. Eso es lo que permite probarlo exhaustivamente con Vitest sin renderizar nada, y lo que permite que toda la app se desarrolle como una web app normal (`vite dev`) sin tocar el toolchain nativo.

## La capa de motor (`src/core/`)

De abajo a arriba:

```
finance.ts        primitivas: pmt, ipmt, ppmt, pv, nper, rateFromPayment, irr
    │
    ├── solve.ts        el solver de 4 vías (capital/cuota/plazo/tipo)
    │
    ├── schedule.ts      cuadro de amortización mes a mes
    │       │
    │       └── tae.ts         TIR sobre los flujos de caja reales del cuadro
    │
    ├── spain/costs.ts   ITP/IVA/AJD, notaría/registro/gestoría/tasación
    ├── spain/limits.ts  LTV, DTI, comisión máxima de amortización anticipada
    │
    └── property.ts      €/m², benchmark de barrio, coste total de propiedad
            │
            └── rentbuy.ts      alquilar vs. comprar
```

### `finance.ts` — convención de signos

A diferencia de Excel, donde `PMT`/`IPMT`/`PPMT` devuelven números negativos para salidas de caja, aquí **todo devuelve el número positivo que se muestra en pantalla** — lo que la hoja de cálculo de referencia obtiene negando esas funciones vía sus rangos con nombre (`Pago_Mensual = -PMT(...)`). Cada función documenta en su JSDoc a qué llamada de Excel equivale, para trazabilidad.

`rateFromPayment` e `irr` no tienen fórmula cerrada (como `RATE`/`IRR` en Excel) — se resuelven con Newton-Raphson y una caída a bisección garantizada por la monotonía de la función objetivo. Ver los comentarios en el código para la demostración de por qué el intervalo de bisección siempre contiene la raíz.

### `solve.ts` — resultado tipado, nunca una excepción

`solveLoan()` devuelve `{ ok: true, ... } | { ok: false, error: string }` en vez de lanzar. Es deliberado: esta función se llama desde selectores que se ejecutan en cada render, y una excepción ahí tumbaría la UI. Un input inválido (cuota que nunca amortiza, tipo negativo) se convierte en un mensaje en español listo para mostrar, no en un `NaN` silencioso ni en un *crash*.

`schedule.ts` y `rentbuy.ts` siguen el mismo patrón.

### `schedule.ts` — el detalle que importa: `plazoMesesEfectivo`

Las hipotecas variables recalculan la cuota en cada revisión para terminar de pagarse en la fecha de vencimiento **original**. Si una amortización anticipada en modo *reducir plazo* ocurre entre dos revisiones, la siguiente revisión — si usara el plazo contratado original sin más — recalcularía la cuota hacia abajo y absorbería silenciosamente el efecto, convirtiendo de facto un *reducir plazo* en un *reducir cuota*.

`schedule.ts` evita esto con una variable `plazoMesesEfectivo`, que arranca igual al plazo contratado y solo se acorta cuando ocurre una amortización en modo *reducir plazo* (recalculando cuántos meses quedarían al ritmo de cuota actual). Las revisiones periódicas usan siempre `plazoMesesEfectivo`, no el plazo original. Hay un test de regresión específico para este caso en `schedule.test.ts`.

### `spain/costs.ts` — exclusión deliberada

Este módulo **no** modela ningún coste de la escritura de hipoteca (notaría, registro, gestoría, AJD de la hipoteca) porque, desde la Ley 5/2019, esos los paga el banco, no el comprador. Solo calcula los costes de la compraventa en sí. Hay un test (`"never includes any mortgage-deed cost"`) que falla si alguna vez se cuela una de esas partidas por error.

## El store y los selectores

`src/store/` tiene cuatro archivos con responsabilidades separadas:

- **`types.ts`** — los tipos del estado. Solo inputs: `ViviendaCandidata`, `HipotecaConfig`, `PerfilFinanciero`, `EscenariosConfig`.
- **`defaults.ts`** — valores iniciales, incluida la vivienda de ejemplo en Garrido que deja la app poblada desde el primer arranque.
- **`useAppStore.ts`** — el store de Zustand: los valores de `types.ts` más un *setter* por cada uno, envuelto en el middleware `persist`.
- **`selectors.ts`** — toda la composición: hooks como `useSolveResult()`, `useSchedule()`, `useTae()`, `useResumenCompra()`, `useAsequibilidad()`, `useRentBuy()`, que leen del store y llaman al motor.

### El puente entre un tipo de interés "simple" y uno "con revisiones"

`solve.ts` opera sobre un único tipo nominal (necesario para tener una fórmula cerrada). `schedule.ts` necesita algo más rico — fijo, variable con revisiones, o mixto. `selectors.ts` reconcilia ambos con dos funciones:

- `tipoAnualEfectivo(config)` — qué tipo nominal usa el solver el día 1, según la modalidad (fijo → el tipo introducido; variable → Euríbor + diferencial; mixto → el tipo fijo inicial).
- `composeTasaConfig(config, solved)` — construye el `TasaConfig` que espera `schedule.ts` a partir de la configuración y del resultado ya resuelto (relevante sobre todo cuando se resuelve *para* el tipo: hay que decidir qué diferencial o tipo fijo implica el tipo resuelto).

### Por qué cada hook suscribe slices individuales, no un objeto combinado

```ts
// Así, no:
const { hipoteca, viviendas } = useAppStore((s) => ({ hipoteca: s.hipoteca, viviendas: s.viviendas }));

// Así:
const hipoteca = useAppStore((s) => s.hipoteca);
const viviendas = useAppStore((s) => s.viviendas);
```

Un selector que devuelve un objeto literal nuevo en cada llamada rompe la comparación por referencia de Zustand y provoca un render en cada cambio de *cualquier* parte del store, no solo de lo que ese hook usa. Suscribir slices individuales (cada uno estable mientras no cambie) evita renders innecesarios sin necesidad de `shallow` ni memoización adicional.

## Flujo de datos

```
Usuario teclea en un <input>
        │
        ▼
setHipoteca({ capitalInput: 180000 })   (acción del store)
        │
        ▼
useAppStore actualiza `hipoteca` (nueva referencia, el resto del store no cambia)
        │
        ▼
Todo componente que suscribe `s => s.hipoteca` vuelve a renderizar
        │
        ▼
useSolveResult() recalcula solveLoan(composeSolveInput(hipoteca))
        │
        ▼
useSchedule() recalcula generateSchedule(...) a partir del resultado anterior
        │
        ▼
useTae() / useAsequibilidad() / useRentBuy() recalculan a partir de ambos
        │
        ▼
La UI (gráficos, tablas, KPIs) renderiza los resultados — nunca escribe de vuelta al store
```

## Persistencia

`src/store/persistStorage.ts` implementa la interfaz `StateStorage` de Zustand con detección de entorno: si `window.__TAURI_INTERNALS__` existe, usa `@tauri-apps/plugin-fs` para leer/escribir un único archivo JSON en el directorio de datos de la app (vía `appDataDir()`); si no, usa `localStorage`. La resolución de backend se memoiza tras la primera llamada.

`useAppStore.ts` usa `partialize` para persistir solo los slices de datos (excluye `activeTab` y todas las funciones), y un `merge` a medida que combina cada slice de configuración por separado contra sus valores por defecto — así, si una versión futura añade un campo nuevo a `HipotecaConfig`, un estado persistido de una versión antigua que no lo tenga recibe el valor por defecto de ese campo en vez de `undefined`.

## Cómo se probó (y cómo probar lo nuevo)

Cada módulo de `src/core/` tiene su `*.test.ts` junto al archivo. La suite completa:

```bash
npm test
```

Patrones usados en los tests existentes, a seguir para código nuevo:

- **Valores dorados**: para cualquier cálculo financiero nuevo, si existe una forma de verificarlo contra una fuente externa (Excel, una calculadora oficial), hazlo — así se verificó `finance.ts` contra la hoja de cálculo de referencia.
- **Round-trip**: si A puede resolver B y B puede resolver A (como `pv`/`pmt`, o el solver de 4 vías), un test que encadena ambos y comprueba que se recupera el valor original detecta más errores de signo/fórmula que probar cada dirección por separado.
- **Casos degenerados**: tipo cero, cuota que no cubre ni los intereses, capital negativo — cada función pública del motor debería tener un test que confirme que esos casos dan un error claro, no `NaN` ni un bucle infinito.
- **Property.ts / rentbuy.ts**: cuando la aritmética es más una decisión de modelo que una fórmula única y verificable, un test de sanidad direccional (p. ej. "alquiler barato + buena rentabilidad alternativa → alquilar gana") es más honesto que fingir un valor dorado inventado.

La UI (`src/ui/`) no tiene tests unitarios — se verificó manualmente con capturas de pantalla reales vía Playwright durante el desarrollo (ver el historial de la sesión de construcción para el detalle de qué se comprobó).

## Añadir una funcionalidad nueva

Ejemplo: añadir un nuevo indicador derivado, "coste por m² financiado".

1. **Motor**: añade la función pura a `src/core/property.ts` (o un módulo nuevo si no encaja en ninguno existente). Sin importar nada de React/Zustand.
2. **Test**: `property.test.ts`, valores dorados o round-trip según aplique.
3. **Selector**: si depende de más de un slice del store (p. ej. la vivienda activa y el resultado de la hipoteca), añade un hook a `src/store/selectors.ts` que los componga — sigue el patrón de `useAsequibilidad()` como plantilla.
4. **UI**: consume el hook en el componente de la pestaña correspondiente. Si es un número suelto, `<StatTile>`; si es una tabla o gráfico nuevo, sigue la paleta y las especificaciones de marca de la skill `dataviz` (colores categóricos en `src/index.css`, nunca un color nuevo inventado sobre la marcha).
