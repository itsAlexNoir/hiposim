import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Changing this (e.g. the active tab) auto-clears a caught error, so switching away recovers without a full reload. */
  resetKey?: unknown;
}

interface State {
  error: Error | null;
}

/**
 * Last-resort safety net. Nothing in this app should throw during render —
 * see src/core/solve.ts's doc comment on the "never throw from render-time
 * code" convention — but if something ever does, React unmounts the whole
 * tree on an uncaught error, leaving a blank page. This turns that into a
 * recoverable message instead.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Error no controlado:", error, info.componentStack);
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
            Ha ocurrido un error inesperado.
          </p>
          <p className="max-w-md text-xs" style={{ color: "var(--text-muted)" }}>
            Puede deberse a un valor inválido en algún campo (por ejemplo, un número negativo).
            Revisa los datos introducidos e inténtalo de nuevo.
          </p>
          <button
            type="button"
            className="rounded border px-3 py-1.5 text-xs"
            style={{ borderColor: "var(--border)", color: "var(--text)" }}
            onClick={() => this.setState({ error: null })}
          >
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
