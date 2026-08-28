# Compilar HipoSim para Windows y macOS

Hay dos caminos: dejar que **GitHub Actions** compile los instaladores por ti (recomendado — es lo que garantiza un `.dmg` de macOS de verdad y evita instalar todo el toolchain nativo en tu máquina), o compilar **en local**, en cada sistema operativo, con Rust y las herramientas nativas instaladas.

Regla que no depende de la herramienta usada: **un `.dmg`/`.app` de macOS solo se puede generar en macOS**, y aunque técnicamente existe *cross-compilation* parcial para Windows desde Linux, lo fiable y lo que soporta esta guía es compilar el `.msi`/`.exe` de Windows en Windows. Por eso el flujo de CI usa runners `windows-latest` y `macos-latest`.

- [Vía recomendada: GitHub Actions](#vía-recomendada-github-actions)
- [Compilar en local — Windows](#compilar-en-local--windows)
- [Compilar en local — macOS](#compilar-en-local--macos)
- [Firma de código y notarización](#firma-de-código-y-notarización)
- [Linux como entorno de desarrollo](#linux-como-entorno-de-desarrollo)
- [Solución de problemas](#solución-de-problemas)

---

## Vía recomendada: GitHub Actions

El repositorio ya incluye `.github/workflows/release.yml`. No requiere que instales nada localmente más allá de `git`.

### 1. Sube el repositorio a GitHub (si no lo has hecho)

```bash
git remote add origin https://github.com/<tu-usuario>/hiposim.git
git branch -M main
git push -u origin main
```

### 2. Actualiza la versión

Edita la versión en dos sitios (deben coincidir):

- `package.json` → `"version"`
- `src-tauri/tauri.conf.json` → `"version"`

### 3. Crea y sube un tag

```bash
git tag v0.1.0
git push origin v0.1.0
```

El `push` del tag dispara el workflow automáticamente. Sin tag no hay build de release — los pushes normales a `main` solo ejecutan `ci.yml` (tests + typecheck, sin compilar el shell nativo).

### 4. Sigue el progreso

En GitHub → pestaña **Actions** → el workflow "Release" tendrá tres jobs en paralelo:

| Job | Runner | Produce |
|---|---|---|
| `release (macos-latest, --target aarch64-apple-darwin)` | macOS | `.dmg` para Apple Silicon (M1/M2/M3/M4) |
| `release (macos-latest, --target x86_64-apple-darwin)` | macOS | `.dmg` para Mac Intel |
| `release (windows-latest, )` | Windows | `.msi` y `.exe` (instalador NSIS) |

Cada job compila el frontend, corre `npm test`, y luego usa [`tauri-action`](https://github.com/tauri-apps/tauri-action) para compilar el binario nativo y empaquetarlo. Tarda entre 8 y 15 minutos por job la primera vez (las siguientes son más rápidas gracias al caché de Rust vía `swatinem/rust-cache`).

### 5. Publica el Release

El workflow crea un **GitHub Release en borrador** (`releaseDraft: true`) con los cuatro archivos adjuntos (`.dmg` ×2, `.msi`, `.exe`). Revísalo en GitHub → **Releases**, edita la descripción si quieres, y pulsa **Publish release** cuando estés conforme. Mientras esté en borrador, nadie más lo ve.

### Volver a compilar sin subir un tag nuevo

El workflow también acepta disparo manual: GitHub → **Actions** → **Release** → **Run workflow**. Útil para probar el pipeline sin crear un tag de versión real.

---

## Compilar en local — Windows

Necesario si quieres depurar el instalador en tu propia máquina Windows o no quieres depender de CI.

### Prerrequisitos

1. **Node.js** (LTS) — [nodejs.org](https://nodejs.org/)
2. **Rust** — instala vía [rustup.rs](https://rustup.rs/); el instalador `rustup-init.exe` detecta Windows automáticamente. Verifica con:
   ```powershell
   rustc --version
   cargo --version
   ```
3. **Microsoft C++ Build Tools** — Tauri en Windows compila con MSVC, no con MinGW. Instala **Visual Studio Build Tools** ([enlace de descarga](https://visualstudio.microsoft.com/visual-cpp-build-tools/)) y en el instalador marca la carga de trabajo **"Desktop development with C++"**.
4. **WebView2** — viene preinstalado en Windows 10/11 actualizados; si tu Windows no lo tiene, el [Evergreen Bootstrapper de Microsoft](https://developer.microsoft.com/microsoft-edge/webview2/) lo instala.

### Compilar

```powershell
git clone https://github.com/<tu-usuario>/hiposim.git
cd hiposim
npm install
npm run tauri build
```

`npm run tauri build` primero compila el frontend (`vite build`) y luego el binario Rust en modo release, generando los instaladores en:

```
src-tauri\target\release\bundle\msi\HipoSim_0.1.0_x64_en-US.msi
src-tauri\target\release\bundle\nsis\HipoSim_0.1.0_x64-setup.exe
```

La primera compilación tarda varios minutos (compila todas las dependencias de Rust desde cero); las siguientes son incrementales y mucho más rápidas.

### Solo probar sin empaquetar

```powershell
npm run tauri dev
```

Abre la app en una ventana nativa con hot-reload, sin generar instalador.

---

## Compilar en local — macOS

### Prerrequisitos

1. **Xcode Command Line Tools**:
   ```bash
   xcode-select --install
   ```
2. **Node.js** (LTS) — vía [nodejs.org](https://nodejs.org/) o `brew install node`.
3. **Rust** — vía [rustup.rs](https://rustup.rs/):
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```
4. **Targets adicionales**, solo si quieres compilar para la arquitectura que NO es la de tu Mac (por ejemplo, compilar para Intel desde un Mac Apple Silicon, o al revés — necesario para producir ambos `.dmg` en una sola máquina):
   ```bash
   rustup target add aarch64-apple-darwin x86_64-apple-darwin
   ```

### Compilar

```bash
git clone https://github.com/<tu-usuario>/hiposim.git
cd hiposim
npm install
npm run tauri build
```

Esto compila para la arquitectura nativa de tu Mac. El instalador queda en:

```
src-tauri/target/release/bundle/dmg/HipoSim_0.1.0_aarch64.dmg    # Apple Silicon
src-tauri/target/release/bundle/macos/HipoSim.app
```

### Compilar para ambas arquitecturas (universal)

```bash
npm run tauri build -- --target universal-apple-darwin
```

Genera un único `.app`/`.dmg` que corre nativamente tanto en Apple Silicon como en Intel (más pesado, pero un solo archivo que distribuir). Requiere tener añadidos ambos targets de Rust (paso 4 de arriba).

### Solo probar sin empaquetar

```bash
npm run tauri dev
```

---

## Firma de código y notarización

Sin firmar, los instaladores funcionan pero disparan avisos del sistema operativo la primera vez que se abren:

- **macOS**: Gatekeeper bloquea la app ("no se puede abrir porque su desarrollador no pudo verificarse"). El usuario debe hacer clic derecho sobre la app → **Abrir**, y confirmar — solo la primera vez.
- **Windows**: SmartScreen muestra "Windows protegió tu PC". El usuario pulsa **Más información** → **Ejecutar de todas formas**.

Para builds firmados (sin esos avisos), añade estos **secrets** en GitHub → Settings → Secrets and variables → Actions. `release.yml` ya está preparado para recogerlos automáticamente si existen:

### macOS (requiere cuenta de Apple Developer, ~99 USD/año)

| Secret | Qué es |
|---|---|
| `APPLE_CERTIFICATE` | Certificado "Developer ID Application" exportado como `.p12`, codificado en base64 |
| `APPLE_CERTIFICATE_PASSWORD` | Contraseña del `.p12` |
| `APPLE_SIGNING_IDENTITY` | Nombre exacto del certificado, p. ej. `Developer ID Application: Tu Nombre (TEAMID)` |
| `APPLE_ID` | Tu Apple ID (para notarización) |
| `APPLE_PASSWORD` | Contraseña específica de aplicación (no la de tu Apple ID) — generada en [appleid.apple.com](https://appleid.apple.com/) |
| `APPLE_TEAM_ID` | Tu Team ID de Apple Developer |

Guía oficial de Tauri: [Signing macOS Applications](https://v2.tauri.app/distribute/sign/macos/).

### Windows (certificado de firma de código)

| Secret | Qué es |
|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | Clave privada del certificado |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Contraseña de la clave |

Guía oficial de Tauri: [Windows Code Signing](https://v2.tauri.app/distribute/sign/windows/).

Sin estos secrets configurados, el workflow compila igualmente instaladores sin firmar — es el comportamiento por defecto y es totalmente válido para uso personal o distribución informal.

---

## Linux como entorno de desarrollo

El shell nativo de Tauri en Linux depende de `webkit2gtk` y, transitivamente, de `libdbus-1-dev`. Si tu distribución no las tiene instaladas, `npm run tauri dev`/`build` fallará al compilar el lado Rust — **esto es un requisito de bibliotecas de sistema, no un problema del código**, y no afecta en absoluto a los builds de Windows o macOS (usan WebView2 y WKWebView respectivamente, sin ninguna dependencia de dbus/gtk).

En Ubuntu/Debian:

```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev libdbus-1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

Lista completa y actualizada por distribución: [Tauri — Prerequisites (Linux)](https://v2.tauri.app/start/prerequisites/#linux).

**Mientras tanto, el desarrollo no se bloquea**: todo el motor de cálculo y la interfaz son una web app pura sin dependencias de Tauri, así que `npm run dev` (Vite, en el navegador) y `npm test` funcionan sin ninguna de estas bibliotecas nativas. Solo `npm run tauri dev`/`build` las necesita.

---

## Solución de problemas

**`error: failed to run custom build command for 'libdbus-sys'` (Linux)**
Falta `libdbus-1-dev` y `pkg-config`. Instálalos (ver sección anterior) — no ocurre en Windows/macOS.

**`error: Microsoft Visual C++ 14.0 or greater is required` (Windows)**
Falta la carga de trabajo "Desktop development with C++" de Visual Studio Build Tools. Reinstálala marcando esa opción.

**`xcrun: error: unable to find utility "actool"` (macOS)**
Faltan las Xcode Command Line Tools o no apuntan al SDK correcto:
```bash
xcode-select --install
sudo xcode-select --switch /Library/Developer/CommandLineTools
```

**El `.dmg`/`.app` se abre pero macOS dice que está "dañado" o "no se puede abrir"**
Build sin firmar. Es esperado (ver [Firma de código](#firma-de-código-y-notarización)) — clic derecho → Abrir, en vez de doble clic.

**`npm run tauri build` compila pero no encuentro el instalador**
Revisa `src-tauri/target/release/bundle/` — cada formato tiene su propia subcarpeta (`msi/`, `nsis/`, `dmg/`, `macos/`). El bloque `bundle.targets: "all"` de `src-tauri/tauri.conf.json` genera todos los formatos soportados por el sistema operativo actual.

**El workflow de GitHub Actions falla en `npm test`**
El release no debería llegar a compilar binarios nativos si los tests del motor fallan — es intencional (`release.yml` corre `npm test` antes del paso de `tauri-action`). Corrige el test localmente con `npm test` antes de re-etiquetar.
