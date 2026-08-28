/**
 * Storage backend for Zustand's `persist` middleware: writes a single JSON
 * file to the OS-appropriate app-data directory when running inside
 * Tauri, and falls back to localStorage when running as a plain web app
 * (`vite dev`, or any future web deployment) — so the exact same store
 * code works in both.
 *
 * Tauri-ness is detected once at module load via the `__TAURI_INTERNALS__`
 * global Tauri injects into the webview. The Tauri backend is resolved
 * lazily (dynamic import) so this module never pulls in `@tauri-apps/*`
 * when running in a plain browser.
 */
import type { StateStorage } from "zustand/middleware";

const FILE_NAME = "hiposim-state.json";

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function buildTauriStorage(): Promise<StateStorage> {
  const { appDataDir, join } = await import("@tauri-apps/api/path");
  const { readTextFile, writeTextFile, mkdir, exists, remove } = await import("@tauri-apps/plugin-fs");

  async function filePath(): Promise<string> {
    const dir = await appDataDir();
    return join(dir, FILE_NAME);
  }

  return {
    async getItem(): Promise<string | null> {
      try {
        const path = await filePath();
        if (!(await exists(path))) return null;
        return await readTextFile(path);
      } catch {
        return null;
      }
    },
    async setItem(_name: string, value: string): Promise<void> {
      const dir = await appDataDir();
      if (!(await exists(dir))) await mkdir(dir, { recursive: true });
      await writeTextFile(await filePath(), value);
    },
    async removeItem(): Promise<void> {
      try {
        const path = await filePath();
        if (await exists(path)) await remove(path);
      } catch {
        // nothing to remove — fine
      }
    },
  };
}

function buildBrowserStorage(): StateStorage {
  return {
    getItem: (name) => localStorage.getItem(name),
    setItem: (name, value) => localStorage.setItem(name, value),
    removeItem: (name) => localStorage.removeItem(name),
  };
}

let resolved: Promise<StateStorage> | null = null;

function resolveBackend(): Promise<StateStorage> {
  if (!resolved) {
    resolved = isTauriRuntime() ? buildTauriStorage().catch(() => buildBrowserStorage()) : Promise.resolve(buildBrowserStorage());
  }
  return resolved;
}

/**
 * A StateStorage that lazily picks its real backend on first use. Every
 * call is async (persist's `createJSONStorage` supports that natively),
 * so this is safe to hand straight to `createJSONStorage(() => persistStorage)`.
 */
export const persistStorage: StateStorage = {
  getItem: async (name) => (await resolveBackend()).getItem(name),
  setItem: async (name, value) => {
    await (await resolveBackend()).setItem(name, value);
  },
  removeItem: async (name) => {
    await (await resolveBackend()).removeItem(name);
  },
};
