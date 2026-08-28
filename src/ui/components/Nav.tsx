import { useAppStore } from "@/store/useAppStore";
import type { TabId } from "@/store/types";

const TABS: { id: TabId; label: string }[] = [
  { id: "panel", label: "Panel" },
  { id: "hipoteca", label: "Hipoteca" },
  { id: "compra", label: "Compra" },
  { id: "viviendas", label: "Viviendas" },
  { id: "escenarios", label: "Escenarios" },
];

export function Nav() {
  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);

  return (
    <nav className="flex gap-1 px-4">
      {TABS.map((tab) => {
        const active = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="border-b-2 px-3 py-2.5 text-sm font-medium transition-colors"
            style={{
              borderColor: active ? "var(--accent)" : "transparent",
              color: active ? "var(--text)" : "var(--text-muted)",
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
