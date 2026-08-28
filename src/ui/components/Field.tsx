import type { ChangeEvent } from "react";

const labelStyle = { color: "var(--text-secondary)" };
const inputClass =
  "tabular-nums w-full rounded border px-2 py-1.5 text-sm outline-none focus:border-[var(--accent)]";
const inputStyle = { background: "var(--surface-raised)", borderColor: "var(--border)", color: "var(--text)" };

export function NumberField({
  label,
  value,
  onChange,
  step = 1,
  min,
  max,
  suffix,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
  disabled?: boolean;
}) {
  const handle = (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.valueAsNumber;
    if (!Number.isNaN(v)) onChange(v);
  };
  return (
    <label className="block text-xs">
      <span style={labelStyle}>{label}</span>
      <div className="relative mt-1">
        <input
          type="number"
          className={inputClass}
          style={inputStyle}
          value={Number.isFinite(value) ? value : ""}
          step={step}
          min={min}
          max={max}
          disabled={disabled}
          onChange={handle}
        />
        {suffix && (
          <span
            className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            {suffix}
          </span>
        )}
      </div>
    </label>
  );
}

/** Stores/emits a fraction (0.032) while displaying/editing a percentage (3.2). */
export function PercentField({
  label,
  value,
  onChange,
  step = 0.05,
  min,
  max,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  return (
    <NumberField
      label={label}
      // Round away binary floating-point noise (e.g. 0.0295*100 =
      // 2.9499999999999997) — display precision only, doesn't affect
      // what gets stored when the user types their own value.
      value={Math.round(value * 100 * 1e6) / 1e6}
      onChange={(v) => onChange(v / 100)}
      step={step}
      min={min}
      max={max}
      suffix="%"
      disabled={disabled}
    />
  );
}

export function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  disabled?: boolean;
}) {
  return (
    <label className="block text-xs">
      <span style={labelStyle}>{label}</span>
      <select
        className={inputClass}
        style={inputStyle}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ToggleField({
  label,
  checked,
  onChange,
  description,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  description?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-xs">
      <input
        type="checkbox"
        className="mt-0.5 accent-[var(--accent)]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span style={{ color: "var(--text)" }}>{label}</span>
        {description && (
          <span className="block" style={{ color: "var(--text-muted)" }}>
            {description}
          </span>
        )}
      </span>
    </label>
  );
}

export function TextField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block text-xs">
      <span style={labelStyle}>{label}</span>
      <input
        type="text"
        className={inputClass}
        style={inputStyle}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
