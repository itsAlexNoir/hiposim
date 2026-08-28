/** Formatting helpers shared by every tab — Spanish (es-ES) locale throughout. */

// useGrouping: "always" — es-ES's default only groups thousands from
// 10,000 up (8000 € but 16.000 €), which reads as inconsistent right next
// to each other in a financial table. Force grouping from 1,000 up instead.
const eur0 = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
  useGrouping: "always",
});
const eur2 = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
  useGrouping: "always",
});
const num0 = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0, useGrouping: "always" });
const num2 = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2, useGrouping: "always" });

export function formatEUR(value: number, decimals: 0 | 2 = 0): string {
  if (!Number.isFinite(value)) return "—";
  return (decimals === 0 ? eur0 : eur2).format(value);
}

export function formatPct(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return "—";
  return `${(value * 100).toLocaleString("es-ES", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} %`;
}

export function formatNumber(value: number, decimals: 0 | 2 = 0): string {
  if (!Number.isFinite(value)) return "—";
  return (decimals === 0 ? num0 : num2).format(value);
}

export function formatM2(value: number): string {
  return `${formatNumber(value)} m²`;
}

export function formatEurPerM2(value: number): string {
  return `${formatNumber(value)} €/m²`;
}

export function formatMonths(totalMonths: number): string {
  const years = Math.floor(totalMonths / 12);
  const months = Math.round(totalMonths % 12);
  const yearsLabel = years === 1 ? "1 año" : `${years} años`;
  const monthsLabel = months === 1 ? "1 mes" : `${months} meses`;
  if (months === 0) return yearsLabel;
  if (years === 0) return monthsLabel;
  return `${yearsLabel} y ${monthsLabel}`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-ES", { year: "numeric", month: "short", day: "2-digit" });
}
