type Status = "neutral" | "good" | "warning" | "critical";

const STATUS_COLOR: Record<Status, string> = {
  neutral: "var(--text)",
  good: "var(--good)",
  warning: "var(--warning)",
  critical: "var(--critical)",
};

export function StatTile({
  label,
  value,
  sublabel,
  status = "neutral",
  title,
}: {
  label: string;
  value: string;
  sublabel?: string;
  status?: Status;
  /** Native hover tooltip (title attribute) — use to explain what the figure means or how it's derived. */
  title?: string;
}) {
  return (
    <div
      className="rounded-lg border px-4 py-3"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      title={title}
    >
      <div className="text-xs" style={{ color: "var(--text-muted)" }}>
        {label}
      </div>
      <div className="tabular-nums mt-1 text-2xl font-semibold" style={{ color: STATUS_COLOR[status] }}>
        {value}
      </div>
      {sublabel && (
        <div className="mt-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>
          {sublabel}
        </div>
      )}
    </div>
  );
}
