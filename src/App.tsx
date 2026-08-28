import { useAppStore } from "@/store/useAppStore";
import { Nav } from "@/ui/components/Nav";
import { ViviendaSwitcher } from "@/ui/components/ViviendaSwitcher";
import { PanelTab } from "@/ui/tabs/PanelTab";
import { HipotecaTab } from "@/ui/tabs/HipotecaTab";
import { CompraTab } from "@/ui/tabs/CompraTab";
import { ViviendasTab } from "@/ui/tabs/ViviendasTab";
import { EscenariosTab } from "@/ui/tabs/EscenariosTab";

function TabContent() {
  const activeTab = useAppStore((s) => s.activeTab);
  switch (activeTab) {
    case "panel":
      return <PanelTab />;
    case "hipoteca":
      return <HipotecaTab />;
    case "compra":
      return <CompraTab />;
    case "viviendas":
      return <ViviendasTab />;
    case "escenarios":
      return <EscenariosTab />;
  }
}

function App() {
  return (
    <div className="flex h-full flex-col" style={{ background: "var(--page)" }}>
      <header className="flex items-center justify-between border-b px-4 py-2" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold tracking-tight" style={{ color: "var(--text)" }}>
            HipoSim
          </span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Simulador de hipotecas · Salamanca
          </span>
        </div>
        <ViviendaSwitcher />
      </header>
      <div className="border-b" style={{ borderColor: "var(--border)" }}>
        <Nav />
      </div>
      <main className="flex-1 overflow-auto p-4">
        <TabContent />
      </main>
    </div>
  );
}

export default App;
